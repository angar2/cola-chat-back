import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const PORT = config.get<number>('PORT');
  const CORS_ORIGIN_DEV = config.get<string>('CORS_ORIGIN_DEV');
  const CORS_ORIGIN_PROD = config.get<string>('CORS_ORIGIN_PROD');

  app.enableCors({
    origin: [CORS_ORIGIN_DEV, CORS_ORIGIN_PROD],
    credentials: true,
  });

  await app.listen(PORT);
}
bootstrap();
