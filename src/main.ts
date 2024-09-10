import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const PORT = config.get<number>('PORT');
  const HTTP_CORS_ORIGIN_DEV = config.get<string>('HTTP_CORS_ORIGIN_DEV');
  const HTTP_CORS_ORIGIN_PROD = config.get<string>('HTTP_CORS_ORIGIN_PROD');

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? HTTP_CORS_ORIGIN_PROD
        : HTTP_CORS_ORIGIN_DEV,
    credentials: true,
  });

  await app.listen(PORT);
}
bootstrap();
