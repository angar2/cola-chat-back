import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UseFilters, UseInterceptors } from '@nestjs/common';
import { WsResponseInterceptor } from 'src/shared/interceptors/ws-response.interceptor';
import { WsErrorExceptionFilter } from 'src/shared/filters/ws-errorException.Filter';

@WebSocketGateway({ namespace: /\/*.+/ })
@UseInterceptors(WsResponseInterceptor)
@UseFilters(WsErrorExceptionFilter)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly chatService: ChatService) {}

  @WebSocketServer() public server: Server;

  // 웹소켓 서버 초기화
  afterInit(server: Server): void {
    console.log('WebSocket Server Init');
  }

  // 웹소켓 연결
  handleConnection(@ConnectedSocket() socket: Socket): void {
    console.log('WebSocket Connected to', socket.nsp.name);
  }

  // 웹소켓 연결 해제
  handleDisconnect(@ConnectedSocket() socket: Socket): void {
    console.log('WebSocket Disconnected from', socket.nsp.name);
  }

  // 방 입장 처리
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody()
    data: { roomId: string; chatterId: string | null },
    @ConnectedSocket() socket: Socket,
  ): Promise<{ data: any }> {
    const result = await this.chatService.handleJoinRoom(data, socket);
    return { data: result };
  }

  // 방 퇴장 처리
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    this.chatService.handleLeaveRoom(data, socket);
  }

  // 메세지 수신 처리
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    await this.chatService.handleSendMessage(data, socket);
  }

  // 공지 수신 처리
  @SubscribeMessage('sendAlert')
  async handleSendAlert(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    await this.chatService.handleSendAlert(data, socket);
  }
}
