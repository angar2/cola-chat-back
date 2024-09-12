import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { ApiErrorExceptionFilter } from '../shared/filters/api-errorException.Filter';
import { ApiResponseInterceptor } from '../shared/interceptors/api-response.interceptor';
import { joiConfigSchema } from 'src/shared/configs/joi.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validationSchema: joiConfigSchema,
      cache: true,
      isGlobal: true,
    }),
    PrismaModule,
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
