import { Controller, Get } from '@nestjs/common';
import {
  type UsersCountResponse,
  type UsersListResponse,
  usersCountResponseSchema,
  usersListResponseSchema,
} from '@postroll/contracts';
// biome-ignore lint/style/useImportType: needed for the decorator
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/')
  async getAll(): Promise<UsersListResponse> {
    return usersListResponseSchema.parse(await this.usersService.getAll());
  }

  @Get('count')
  async getCount(): Promise<UsersCountResponse> {
    return usersCountResponseSchema.parse({
      count: await this.usersService.getCount(),
    });
  }
}
