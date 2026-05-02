import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env['PORT'] ?? 8080);
  await app.listen(Number.isFinite(port) ? port : 8080);
}
bootstrap();
