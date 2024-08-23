import { Injectable, NotFoundException } from '@nestjs/common';
import { COMMENTS } from 'src/shared/constants/comment';
import { RedisService } from 'src/shared/redis/redis.service';
import { Socket, Namespace } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { EVENTS } from 'src/shared/enum';

@Injectable()
export class ChatService {
  private readonly redisClient;

  constructor(private readonly redisService: RedisService) {
    this.redisClient = this.redisService.getClient();
  }

  // 방 생성
  async createRoom(data: {
    namespace: string;
    title: string;
  }): Promise<{ id: string }> {
    const id = await this.generateRoomId();
    const roomData = { id, ...data };

    // 데이터 처리
    await this.redisClient.hset(`room:${id}`, roomData);
    await this.redisClient.sadd('rooms', id);

    return { id };
  }

  // 방 id 생성
  private async generateRoomId(): Promise<string> {
    let roomId: string;
    do roomId = uuid();
    while (await this.redisClient.exists(roomId));
    return roomId;
  }

  // 방 전체 조회
  async getRooms(): Promise<string[]> {
    const roomIds = await this.redisClient.smembers('rooms');
    return await Promise.all(
      roomIds.map((id) => this.redisClient.hgetall(`room:${id}`)),
    );
  }

  // 특정 방 조회
  async getRoom(roomId: string): Promise<Record<string, string>> {
    const roomData = await this.redisClient.hgetall(`room:${roomId}`);

    if (!roomData || Object.keys(roomData).length === 0)
      throw new NotFoundException();

    return roomData;
  }

  // 특정 방 메시지 전체 조회
  async getMessagesFromRoom(roomId: string): Promise<string[]> {
    const messageIds = await this.redisClient.smembers('messages');
    const messages = await Promise.all(
      messageIds.map(async (messageId) => {
        const message = await this.redisClient.hgetall(`message:${messageId}`);
        return { ...message, id: messageId };
      }),
    );
    return messages.filter((message) => message.roomId === roomId);
  }

  // 방 입장 처리
  handleJoinRoom(
    data: { roomId: string; nickname: string },
    socket: Socket,
  ): void {
    const { roomId, nickname } = data;
    const namespace: Namespace = socket.nsp;

    // 넥네임 설정
    (socket.data.nicknames ||= {})[roomId] = nickname;

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
  handleLeaveRoom(data: { roomId: string }, socket: Socket): void {
    const { roomId } = data;
    const namespace: Namespace = socket.nsp;

    // 닉네임 제거
    const nickname = socket.data.nicknames?.[roomId];
    delete socket.data.nicknames?.[roomId];

    // 퇴장 처리
    socket.leave(roomId);

    // 코멘트 전송
    const messageData = {
      evnet: EVENTS.PING,
      namespace,
      roomId,
      content: { message: COMMENTS.userLeft(nickname) },
    };
    this.emit(messageData);
  }

  // 메세지 수신 처리
  async handleMessage(
    data: { roomId: string; message: string },
    socket: Socket,
  ): Promise<void> {
    const { roomId, message } = data;
    const namespace: Namespace = socket.nsp;
    const nickname: string = socket.data.nicknames[roomId];

    // 데이터 처리
    const id = await this.redisClient.incr('messageIdCounter');
    await this.redisClient.hset(`message:${id}`, {
      id,
      message,
      nickname,
      roomId,
    });
    await this.redisClient.sadd('messages', id);

    // 코멘트 전송
    const messageData = {
      evnet: EVENTS.MESSAGE,
      namespace,
      roomId,
      content: { nickname, message },
    };
    this.emit(messageData);
  }

  // 전송
  emit(data): void {
    const { evnet, namespace, roomId, content } = data;
    namespace.to(roomId).emit(evnet, content);
  }
}
