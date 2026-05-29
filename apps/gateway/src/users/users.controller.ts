import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  changePasswordRequestSchema,
  type UserDto,
  updateUserRequestSchema,
  userDtoSchema,
} from '@postroll/contracts';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// biome-ignore lint/style/useImportType: needed for the decorator
import { TokensService } from '../auth/tokens.service';
// biome-ignore lint/style/useImportType: needed for the decorator
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokens: TokensService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: RequestUser): Promise<UserDto> {
    const found = await this.usersService.findById(user.id);
    if (!found) {
      throw new NotFoundException('User not found');
    }
    return userDtoSchema.parse(found);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ): Promise<UserDto> {
    const input = updateUserRequestSchema.parse(body);
    return userDtoSchema.parse(await this.usersService.update(user.id, input));
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Headers('x-postroll-refresh-token') currentRefreshToken?: string,
  ): Promise<void> {
    const input = changePasswordRequestSchema.parse(body);
    await this.usersService.changePassword(
      user.id,
      input.currentPassword,
      input.newPassword,
    );

    if (input.revokeOtherSessions) {
      await this.tokens.revokeOtherFamilies(user.id, currentRefreshToken);
    }
  }
}
