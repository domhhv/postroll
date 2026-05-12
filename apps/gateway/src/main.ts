import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const port = app.get(ConfigService).get<number>('PORT', 8080);
  await app.listen(port);
  console.log(`Gateway is listening on port ${port}`);
}

void bootstrap();
