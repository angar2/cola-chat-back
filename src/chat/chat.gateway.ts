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
import { COMMENTS } from 'src/shared/constants/comment';

@WebSocketGateway({ namespace: /\/*.+/ })
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
  @SubscribeMessage('join')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; nickname: string },
    @ConnectedSocket() socket: Socket,
  ): void {
    this.chatService.handleJoinRoom(data, socket);
  }

  // 방 퇴장 처리
  @SubscribeMessage('leave')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: Socket,
  ): void {
    this.chatService.handleLeaveRoom(data, socket);
  }

  // 메세지 수신 처리
  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: { roomId: string; message: string },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    await this.chatService.handleMessage(data, socket);
  }
}
