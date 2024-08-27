import { Injectable, NotFoundException } from '@nestjs/common';
import { COMMENTS } from 'src/shared/constants/comment';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { Socket, Namespace } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { SocketEvent } from 'src/shared/types/enum';
import { addDays } from 'src/shared/utils/date';
import { EXPIRY_DAYS, MESSAGE_LIMIT } from 'src/shared/constants/config';
import { Message, MessageType, Participant, Room } from '@prisma/client';
import generateNickname from 'src/shared/utils/nickname';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 방 생성
  async createRoom(data: { namespace: string; title: string }): Promise<Room> {
    const roomId = await this.generateId(this.prisma.room);
    const expiresAt = addDays(new Date(), EXPIRY_DAYS);
    const roomData = { id: roomId, expiresAt, ...data };

    // 데이터 처리
    const resilt = await this.prisma.room.create({
      data: roomData,
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
  async getMessagesFromRoom(params: {
    roomId: string;
    page: number;
  }): Promise<Message[]> {
    const { roomId, page } = params;
    const result = await this.prisma.message.findMany({
      where: { roomId },
      include: {
        participant: true,
      },
      skip: (page - 1) * MESSAGE_LIMIT,
      take: MESSAGE_LIMIT,
      orderBy: {
        sentAt: 'desc',
      },
    });

    return result.reverse();
  }

  // 방 입장 처리
  async handleJoinRoom(
    data: { roomId: string; participantId: string | null },
    socket: Socket,
  ): Promise<Participant> {
    const { roomId, participantId } = data;
    const namespace: Namespace = socket.nsp;

    // 입장 처리
    socket.join(roomId);

    // 참여자 데이터 처리
    let participant: Participant;
    if (participantId) {
      // 참여자 조회
      participant = await this.prisma.participant.findUnique({
        where: { id: participantId },
      });
    } else {
      // 참여자 생성
      const participantId = await this.generateId(this.prisma.participant);
      const nickname = generateNickname();

      participant = await this.prisma.participant.create({
        data: { id: participantId, nickname },
      });

      // 메세지 저장
      const message = await this.createMessage({
        type: MessageType.PING,
        content: COMMENTS.userJoined(nickname),
        roomId,
        participantId,
      });

      // 메세지 전송
      this.emit(namespace, message);
    }

    // 소켓 참여자 설정
    (socket.data.participants ||= {})[roomId] = participant.id;

    return participant;
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

    // 메세지 저장
    const message = await this.createMessage({
      type: MessageType.PING,
      content: COMMENTS.userLeft(participant.nickname),
      roomId,
      participantId,
    });

    // 메세지 전송
    this.emit(namespace, message);
  }

  // 메세지 수신 처리
  async handleMessage(
    data: { roomId: string; content: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, content } = data;
    const namespace: Namespace = socket.nsp;
    const participantId: string = socket.data.participants?.[roomId];

    // 메세지 저장
    const message = await this.createMessage({
      type: MessageType.MESSAGE,
      content,
      roomId,
      participantId,
    });

    // 메세지 전송
    this.emit(namespace, message);
  }

  // 메세지 저장
  async createMessage(messageData): Promise<Message> {
    const { type, content, roomId, participantId } = messageData;
    return await this.prisma.message.create({
      data: {
        type,
        content,
        room: {
          connect: { id: roomId },
        },
        participant: {
          connect: { id: participantId },
        },
      },
      include: {
        participant: true,
      },
    });
  }

  // 전송 처리
  emit(namespace: Namespace, data: Message): void {
    const { roomId, type } = data;
    namespace.to(roomId).emit(SocketEvent[type], data);
  }
}
