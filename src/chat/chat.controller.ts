import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 방 생성
  @Post('rooms')
  async createRoom(@Body() data: { namespace: string; title: string }) {
    const payload = await this.chatService.createRoom(data);
    return { statusCode: 201, payload };
  }

  // 방 전체 조회
  @Get('rooms')
  async getRooms() {
    const payload = await this.chatService.getRooms();
    return { statusCode: 200, payload };
  }

  // 특정 방 조회
  @Get('rooms/:roomId')
  async getRoom(@Param('roomId') roomId: string) {
    const payload = await this.chatService.getRoom(roomId);
    return { statusCode: 200, payload };
  }

  // 특정 방의 참여자 메시지 전체 조회
  @Get('messages/:roomId/:page/:participantId?')
  async getMessagesFromRoom(
    @Param() params: { roomId: string; page: number; participantId?: string },
  ) {
    const payload = await this.chatService.getMessagesFromRoom(params);
    return { statusCode: 200, payload };
  }
}
