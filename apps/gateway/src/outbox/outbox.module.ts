import { Module } from '@nestjs/common';

import { OutboxController } from './outbox.controller.js';
import { OutboxService } from './outbox.service.js';

@Module({
  controllers: [OutboxController],
  exports: [OutboxService],
  providers: [OutboxService],
})
export class OutboxModule {}
