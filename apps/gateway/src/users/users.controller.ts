import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  type UserDto,
  type UsersCountResponse,
  type UsersListResponse,
  userDtoSchema,
  usersCountResponseSchema,
  usersListResponseSchema,
} from '@postroll/contracts';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// biome-ignore lint/style/useImportType: needed for the decorator
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/')
  async getAll(): Promise<UsersListResponse> {
    return usersListResponseSchema.parse(await this.usersService.getAll());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: RequestUser): Promise<UserDto> {
    const found = await this.usersService.findById(user.id);
    if (!found) {
      throw new NotFoundException('User not found');
    }
    return userDtoSchema.parse(found);
  }

  @Get('count')
  async getCount(): Promise<UsersCountResponse> {
    return usersCountResponseSchema.parse({
      count: await this.usersService.getCount(),
    });
  }
}
