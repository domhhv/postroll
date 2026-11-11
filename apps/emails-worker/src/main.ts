import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';

/**
 * No HTTP server: the worker only consumes from RabbitMQ. On SIGTERM, Nest
 * runs the shutdown hooks, so the consumer drains before the connection closes.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
