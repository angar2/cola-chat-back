import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { ApiErrorExceptionFilter } from './shared/filters/api-errorException.Filter';
import { ApiResponseInterceptor } from './shared/interceptors/api-response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),
    PrismaModule,
    RedisModule,
    ChatModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiErrorExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
  ],
})
export class AppModule {}
