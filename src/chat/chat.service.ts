import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { COMMENTS } from 'src/shared/constants/comment';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { Socket, Namespace } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { SocketEvent } from 'src/shared/types/enum';
import { addDays } from 'src/shared/utils/date';
import {
  EXPIRY_DAYS,
  LEAVE_MESSAGE_DELAY_TIME,
  MESSAGE_LIMIT,
  SALT_ROUNDS,
} from 'src/shared/constants/config';
import { Message, MessageType, Chatter, Prisma, Room } from '@prisma/client';
import generateNickname from 'src/shared/utils/nickname';
import * as bcrypt from 'bcrypt';

type RoomWithoutPassword = Omit<Room, 'password'>;

@Injectable()
export class ChatService {
  private onlineClients = new Map<string, Map<string, Set<string>>>();
  private leaveTimeout: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // 방 생성
  async createRoom(data: {
    namespace: string;
    title: string;
    capacity: number;
    isPassword: boolean;
    password?: string;
  }): Promise<RoomWithoutPassword> {
    const { namespace, title, capacity, isPassword, password = null } = data;

    // 데이터 논리 검증
    if ((isPassword && !password) || (!isPassword && password))
      throw new BadRequestException(COMMENTS.ERROR.INVALID_DATA);

    const roomId = await this.generateId(this.prisma.room);
    const expiresAt = addDays(new Date(), EXPIRY_DAYS);

    const roomData = {
      id: roomId,
      namespace,
      title,
      capacity,
      isPassword,
      password,
      expiresAt,
    };

    // 비밀번호 해시
    if (data.password)
      roomData.password = await bcrypt.hash(data.password, SALT_ROUNDS);

    // 데이터 처리
    const resilt = await this.prisma.room.create({
      data: roomData,
      omit: { password: true },
    });

    return resilt;
  }

  // 방 id 생성
  private async generateId(prismaModel: {
    count: (args: any) => Promise<number>;
  }): Promise<string> {
    let id: string;
    let exists: boolean;

    do {
      id = uuid();
      exists = (await prismaModel.count({ where: { id } })) > 0;
    } while (exists);

    return id;
  }

  // 방 전체 조회
  async getRooms(): Promise<RoomWithoutPassword[]> {
    return await this.prisma.room.findMany({ omit: { password: true } });
  }

  // 특정 방 조회
  async getRoom(roomId: string): Promise<RoomWithoutPassword> {
    const result = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomChatters: { where: { isActive: true } } },
    });
    if (!result) throw new NotFoundException(COMMENTS.ERROR.CHAT_NOT_FOUND);

    return result;
  }

  // 방 입장 검증
  async validateRoomEntry(
    roomId: string,
    data: { password?: string },
  ): Promise<boolean> {
    const room = await this.checkRoomExpired(roomId); // 만료 검증
    const isValid = await this.verifyRoomPassword(data.password, room.password); // 비밀번호 검증
    if (!isValid) return false;
    const result = await this.validateRoomExceeded(roomId, room.capacity); // 인원수 확인

    return result;
  }

  // 특정 방의 채터 메시지 전체 조회
  async getMessagesFromRoom(params: {
    roomId: string;
    page: number;
    chatterId?: string;
  }): Promise<Message[]> {
    const { roomId, page, chatterId } = params;

    // 채팅방 만료 확인
    await this.checkRoomExpired(roomId);

    if (!chatterId) return [];

    const message = await this.prisma.message.findFirst({
      where: { roomId, chatterId },
      orderBy: { sentAt: 'asc' },
      select: { sentAt: true },
    });

    let whereInput: Prisma.MessageWhereInput = {
      roomId,
      ...(message ? { sentAt: { gte: message.sentAt } } : {}),
    };

    const result = await this.prisma.message.findMany({
      where: whereInput,
      include: { chatter: true },
      skip: (page - 1) * MESSAGE_LIMIT,
      take: MESSAGE_LIMIT,
      orderBy: { sentAt: 'desc' },
    });

    return result.reverse();
  }

  // 채터 닉네임 변경
  async updateNickname(
    params: { chatterId: string },
    data: { nickname: string },
  ): Promise<Chatter> {
    const { chatterId } = params;
    const { nickname } = data;

    const chatter = await this.prisma.chatter.findUnique({
      where: { id: chatterId },
    });

    if (!chatter) throw new NotFoundException(COMMENTS.ERROR.CHATTER_NOT_FOUND);

    // 닉네임 변경
    const result = await this.prisma.chatter.update({
      where: { id: chatter.id },
      data: { nickname },
    });

    return result;
  }

  // 방 입장 처리
  async handleJoinRoom(
    data: { roomId: string; chatterId: string | null },
    socket: Socket,
  ): Promise<Chatter> {
    const { roomId, chatterId } = data;
    const namespace: Namespace = socket.nsp;

    // 입장 처리
    socket.join(roomId);

    // 채터 데이터 처리
    let chatter: Chatter;
    if (chatterId) {
      // 채터 조회
      chatter = await this.prisma.chatter.findUnique({
        where: { id: chatterId },
      });
    } else {
      // 채터 생성
      const chatterId = await this.generateId(this.prisma.chatter);
      const nickname = generateNickname();

      chatter = await this.prisma.chatter.create({
        data: { id: chatterId, nickname },
      });
    }

    // 소켓 채터 설정
    (socket.data.chatters ||= {})[roomId] = chatter.id;

    // 퇴장 타임아웃 제거
    const timeoutKey = `${roomId}-${chatter.id}`;
    const leaveTimeout = this.leaveTimeout.get(timeoutKey);
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      this.leaveTimeout.delete(timeoutKey);
    } else {
      const chatterIds = this.getOnlineClients(roomId);
      if (!chatterIds.includes(chatterId)) {
        // 메세지 저장
        const message = await this.createMessage({
          type: MessageType.PING,
          content: COMMENTS.SOCKET.userJoined(chatter.nickname),
          roomId,
          chatterId: chatter.id,
        });

        // 웹소켓 전송
        this.emit<Message>(namespace, roomId, SocketEvent.PING, message);
      }
    }

    // 채팅방 온라인 상태 처리
    this.handleOnlineClients(socket, roomId, chatter.id, {
      isAdding: true,
    });

    // 채팅방 온라인 상태 전송
    await this.emitOnlineClients(socket, roomId);

    return chatter;
  }

  // 방 퇴장 처리
  async handleLeaveRoom(
    data: { roomId: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId } = data;
    const namespace: Namespace = socket.nsp;

    // 소켓 채터 제거
    const chatterId: string = socket.data.chatters?.[roomId];
    delete socket.data.chatters?.roomId;

    // 퇴장 처리
    socket.leave(roomId);

    // 채팅방 온라인 상태 처리
    this.handleOnlineClients(socket, roomId, chatterId, {
      isAdding: false,
    });

    const chatterIds = this.getOnlineClients(roomId);
    if (!chatterIds.includes(chatterId)) {
      // 퇴장 메세지 처리
      const timeoutKey = `${roomId}-${chatterId}`;
      const timeout = setTimeout(async () => {
        // 채터 데이터 처리
        const chatter = await this.prisma.chatter.update({
          where: { id: chatterId },
          data: { deletedAt: new Date(), isActive: false },
        });

        // 메세지 저장
        const message = await this.createMessage({
          type: MessageType.PING,
          content: COMMENTS.SOCKET.userLeft(chatter.nickname),
          roomId,
          chatterId,
        });

        // 웹소켓 전송
        this.emit<Message>(namespace, roomId, SocketEvent.PING, message);

        // 채팅방 온라인 상태 전송
        await this.emitOnlineClients(socket, roomId);

        // 타임아웃 제거
        this.leaveTimeout.delete(timeoutKey);
      }, LEAVE_MESSAGE_DELAY_TIME);

      this.leaveTimeout.set(timeoutKey, timeout);
    }
  }

  // 메세지 수신 처리
  async handleMessage(
    data: { roomId: string; content: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, content } = data;
    const namespace: Namespace = socket.nsp;
    const chatterId: string = socket.data.chatters?.[roomId];

    // 채팅방 만료 확인
    await this.checkRoomExpired(roomId);

    // 메세지 저장
    const message = await this.createMessage({
      type: MessageType.MESSAGE,
      content,
      roomId,
      chatterId,
    });

    // 웹소켓 전송
    this.emit<Message>(namespace, roomId, SocketEvent.MESSAGE, message);
  }

  // 공지 수신 처리
  async handlePing(
    data: { roomId: string; content: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, content } = data;
    const namespace: Namespace = socket.nsp;
    const chatterId: string = socket.data.chatters?.[roomId];

    // 채팅방 만료 확인
    await this.checkRoomExpired(roomId);

    // 메세지 저장
    const message = await this.createMessage({
      type: MessageType.PING,
      content,
      roomId,
      chatterId,
    });

    // 웹소켓 전송
    this.emit<Message>(namespace, roomId, SocketEvent.PING, message);
  }

  // 채팅방 온라인 상태 전송
  private async emitOnlineClients(
    socket: Socket,
    roomId: string,
  ): Promise<void> {
    const namespace: Namespace = socket.nsp;

    // onlineClients 조회
    const chatterIds = this.getOnlineClients(roomId);
    const chatters = await this.prisma.chatter.findMany({
      where: { id: { in: chatterIds } },
    });

    // 웹소켓 전송
    this.emit<Chatter[]>(namespace, roomId, SocketEvent.CHATTERS, chatters);
  }

  // 채팅방 온라인 상태 처리
  private handleOnlineClients(
    socket: Socket,
    roomId: string,
    chatterId: string,
    option?: { isAdding: boolean },
  ): void {
    const { isAdding = true } = option;

    // onlineClients 처리
    if (isAdding) this.addSocketToOnline(roomId, chatterId, socket.id);
    else this.removeSocketFromOnline(roomId, chatterId, socket.id);
  }

  // 메세지 저장
  async createMessage(messageData): Promise<Message> {
    const { type, content, roomId, chatterId } = messageData;
    return await this.prisma.message.create({
      data: {
        type,
        content,
        room: {
          connect: { id: roomId },
        },
        chatter: {
          connect: { id: chatterId },
        },
      },
      include: {
        chatter: true,
      },
    });
  }

  // 전송 처리
  emit<T>(
    namespace: Namespace,
    roomId: string,
    event: SocketEvent,
    data: T,
  ): void {
    namespace.to(roomId).emit(event, data);
  }

  // 채팅방 만료 확인
  private async checkRoomExpired(roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) throw new NotFoundException(COMMENTS.ERROR.CHAT_NOT_FOUND);
    if (room.expiresAt < new Date()) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { isExpired: true },
      });
      throw new NotFoundException(COMMENTS.ERROR.CHAT_EXPIRED);
    }

    return room;
  }

  // 채팅방 인원수 확인
  private async validateRoomExceeded(
    roomId: string,
    capacity: number,
  ): Promise<boolean> {
    const onlineCount = this.onlineClients.get(roomId)?.size;
    if (onlineCount && onlineCount >= capacity)
      throw new NotFoundException(COMMENTS.ERROR.ROOM_CAPACITY_FULL);
    return true;
  }

  // 방 비밀번호 검증
  private async verifyRoomPassword(
    inputPassword?: string,
    storedPassword?: string,
  ): Promise<boolean> {
    if (inputPassword) {
      const isValid = await bcrypt.compare(inputPassword, storedPassword || '');
      return isValid;
    }
    return true;
  }

  // 온라인에 소켓 추가
  private addSocketToOnline(
    roomId: string,
    chatterId: string,
    socketId: string,
  ): void {
    if (!this.onlineClients.has(roomId))
      this.onlineClients.set(roomId, new Map());

    const room = this.onlineClients.get(roomId);
    if (!room.has(chatterId)) room.set(chatterId, new Set());

    const sockets = room!.get(chatterId);
    sockets.add(socketId);
  }

  // 온라인에 소켓 제거
  private removeSocketFromOnline(
    roomId: string,
    chatterId: string,
    socketId: string,
  ): void {
    const room = this.onlineClients.get(roomId);
    if (room && room.has(chatterId)) {
      const sockets = room.get(chatterId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) room.delete(chatterId);
        if (room.size === 0) this.onlineClients.delete(roomId);
      }
    }
  }

  // 채팅방 온라인 상태 조회
  private getOnlineClients(roomId: string): string[] {
    const room = this.onlineClients.get(roomId);
    return room ? Array.from(room.keys()) : [];
  }
}
