import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: needed for the DI constructor injection
import { Pool } from "pg";

@Injectable()
export class UsersService {
  constructor(private readonly pool: Pool) {}

  async getCount(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM users",
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getAll() {
    const { rows } = await this.pool.query("SELECT * FROM users");
    return rows;
  }
}
