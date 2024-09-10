import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const PORT = config.get<number>('PORT');
  const HTTP_CORS_ORIGIN = config.get<string>('HTTP_CORS_ORIGIN');

  app.enableCors({
    origin: HTTP_CORS_ORIGIN,
    credentials: true,
  });

  await app.listen(PORT);
}
bootstrap();
