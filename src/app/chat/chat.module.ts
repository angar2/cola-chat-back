import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from 'src/shared/prisma/prisma.module';
import { WsResponseInterceptor } from 'src/shared/interceptors/ws-response.interceptor';

@Module({
  imports: [PrismaModule],
  providers: [ChatGateway, ChatService, WsResponseInterceptor],
  controllers: [ChatController],
})
export class ChatModule {}
