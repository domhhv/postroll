import { Post, HttpCode, Controller, HttpStatus } from '@nestjs/common';

import { OutboxService, type SweepResult } from './outbox.service.js';

/**
 * Called hourly by a Vercel Schedule through web's `/api/internal/outbox-sweep`
 * route, which checks `CRON_SECRET`. The gateway has no public route, so only
 * the web service can reach this.
 */
@Controller('internal/outbox')
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Post('sweep')
  @HttpCode(HttpStatus.OK)
  sweep(): Promise<SweepResult> {
    return this.outbox.sweep();
  }
}
