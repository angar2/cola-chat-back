import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 방 생성
  @Post('rooms')
  async createRoom(
    @Body()
    data: {
      namespace: string;
      title: string;
      capacity: number;
      isPassword: boolean;
      password?: string;
    },
  ) {
    const result = await this.chatService.createRoom(data);
    return { statusCode: 201, data: result };
  }

  // 방 전체 조회
  @Get('rooms')
  async getRooms() {
    const result = await this.chatService.getRooms();
    return { statusCode: 200, data: result };
  }

  // 특정 방 조회
  @Get('rooms/:roomId')
  async getRoom(@Param('roomId') roomId: string) {
    const result = await this.chatService.getRoom(roomId);
    return { statusCode: 200, data: result };
  }

  // 방 입장 검증
  @Post('rooms/:roomId/access-check')
  async validateRoomEntry(
    @Param('roomId') roomId: string,
    @Body() data: { password?: string },
  ) {
    const result = await this.chatService.validateRoomEntry(roomId, data);
    return { statusCode: 200, data: result };
  }

  // 특정 방의 채터 메시지 전체 조회
  @Get('messages/:roomId/:page/:chatterId?')
  async getMessagesFromRoom(
    @Param() params: { roomId: string; page: number; chatterId?: string },
  ) {
    const result = await this.chatService.getMessagesFromRoom(params);
    return { statusCode: 200, data: result };
  }

  // 채터 닉네임 변경
  @Patch('chatters/:chatterId/nickname')
  async updateNickname(
    @Param() params: { chatterId: string },
    @Body() data: { nickname: string },
  ) {
    const result = await this.chatService.updateNickname(params, data);
    return { statusCode: 200, data: result };
  }
}
