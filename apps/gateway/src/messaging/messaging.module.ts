import { Global, Module } from '@nestjs/common';

import { EventBus } from './event-bus.service.js';

@Global()
@Module({
  exports: [EventBus],
  providers: [EventBus],
})
export class MessagingModule {}
