import { Controller, Get } from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the decorator
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('count')
  async getCount(): Promise<{ count: number }> {
    return { count: await this.usersService.getCount() };
  }
}
