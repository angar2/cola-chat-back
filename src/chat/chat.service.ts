import { Injectable, NotFoundException } from '@nestjs/common';
import { COMMENTS } from 'src/shared/constants/comment';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { Socket, Namespace } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { EVENTS } from 'src/shared/enum';
import { addDays } from 'src/shared/utils/date';
import { EXPIRY_DAYS } from 'src/shared/constants/config';
import { Message, Room } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
  ) {
  }

  // 방 생성
  async createRoom(data: {
    namespace: string;
    title: string;
  }): Promise<{ id: string }> {
    const id = await this.generateId(this.prisma.room);
    const expiresAt = addDays(new Date(), EXPIRY_DAYS);
    const roomData = { id, expiresAt, ...data };

    // 데이터 처리
    await this.prisma.room.create({
      data: roomData,
    });

    return { id };
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
  async getRooms(): Promise<Room[]> {
    return this.prisma.room.findMany();
  }

  // 특정 방 조회
  async getRoom(roomId: string): Promise<Room> {
    const result = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!result) throw new NotFoundException();

    return result;
  }

  // 특정 방 메시지 전체 조회
  async getMessagesFromRoom(roomId: string): Promise<Message[]> {
    const result = await this.prisma.message.findMany({
      where: { roomId },
      include: {
        participant: true,
      },
    });

    return result;
  }

  // 방 입장 처리
  async handleJoinRoom(
    data: { roomId: string; nickname: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, nickname } = data;
    const namespace: Namespace = socket.nsp;

    // 참여자 데이터 처리
    const id = await this.generateId(this.prisma.participant);
    await this.prisma.participant.create({
      data: { id, nickname },
    });

    // 소켓 참여자 설정
    (socket.data.participants ||= {})[roomId] = id;

    // 입장 처리
    socket.join(roomId);

    // 코멘트 전송
    const messageData = {
      evnet: EVENTS.PING,
      namespace,
      roomId,
      content: { message: COMMENTS.userJoined(nickname) },
    };
    this.emit(messageData);
  }

  // 방 퇴장 처리
  async handleLeaveRoom(
    data: { roomId: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId } = data;
    const namespace: Namespace = socket.nsp;

    // 소켓 참여자 제거
    const participantId: string = socket.data.participants?.[roomId];
    delete socket.data.participants?.roomId;
    
    // 참여자 데이터 처리
    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: { deletedAt: new Date(), isActive: false },
    });

    // 퇴장 처리
    socket.leave(roomId);

    // 코멘트 전송
    const messageData = {
      evnet: EVENTS.PING,
      namespace,
      roomId,
      content: { message: COMMENTS.userLeft(participant.nickname) },
    };
    this.emit(messageData);
  }

  // 메세지 수신 처리
  async handleMessage(
    data: { roomId: string; content: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, content } = data;
    const namespace: Namespace = socket.nsp;
    const nickname: string = socket.data.nicknames[roomId];
    const participantId: string = socket.data.participants?.[roomId];

    // 데이터 처리
    const messageData = {
      content,
      nickname,
      room: {
        connect: { id: roomId },
      },
      participant: {
        connect: { id: participantId },
      },
    };
    await this.prisma.message.create({
      data: messageData,
    });

    // 코멘트 전송
    const sendData = {
      evnet: EVENTS.MESSAGE,
      namespace,
      roomId,
      content: { nickname, content },
    };
    this.emit(sendData);
  }

  // 전송
  emit(data): void {
    const { evnet, namespace, roomId, content } = data;
    namespace.to(roomId).emit(evnet, content);
  }
}
