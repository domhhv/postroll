import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Global()
@Module({
  providers: [
    {
      provide: Pool,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL');
        console.log({ connectionString });

        return new Pool({
          connectionString,
        });
      },
    },
  ],
  exports: [Pool],
})
export class DatabaseModule {}
