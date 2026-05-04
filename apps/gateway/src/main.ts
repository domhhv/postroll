import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { PORT = 8080 } = process.env;
  await app.listen(PORT);
}
bootstrap();
