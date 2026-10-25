import { Get, Controller, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaClient } from '@postroll/database/prisma';

import { InjectPrisma } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  /** Also pings Postgres, so deploy smoke checks catch a bad DATABASE_URL. */
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ database: 'unreachable', status: 'degraded' });
    }

    return { database: 'ok', status: 'ok' };
  }
}
