import { Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the DI constructor injection
import { UsersService } from './users/users.service';

@Injectable()
export class AppService {
  constructor(private readonly usersService: UsersService) {}

  async getHello(): Promise<string> {
    const count = await this.usersService.getCount();
    return `Hello Postroll! API is live. Users count: ${count}.`;
  }
}
