import { Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the DI constructor injection
import { Pool } from 'pg';

@Injectable()
export class UsersService {
  constructor(private readonly pool: Pool) {}

  async getCount(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM "public"."User"',
    );
    return Number(rows[0]?.count ?? 0);
  }
}
