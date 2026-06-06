import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@postroll/database/prisma';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

export function InjectPrisma() {
  return Inject(PRISMA_CLIENT);
}

function createAdapter(connectionString: string) {
  const isNeon = /\.neon\.tech(?::|\/|$)/.test(connectionString);

  return isNeon ? new PrismaNeon({ connectionString }) : new PrismaPg({ connectionString });
}

@Global()
@Module({
  exports: [PRISMA_CLIENT],
  providers: [
    {
      inject: [ConfigService],
      provide: PRISMA_CLIENT,
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL');

        return new PrismaClient({ adapter: createAdapter(connectionString) });
      },
    },
  ],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
