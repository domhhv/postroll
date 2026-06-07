import {
  Get,
  Body,
  Param,
  Patch,
  Delete,
  Headers,
  HttpCode,
  UseGuards,
  Controller,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  type UserDto,
  userDtoSchema,
  type SessionList,
  sessionListSchema,
  updateUserRequestSchema,
  changePasswordRequestSchema,
} from '@postroll/contracts';

import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TokensService } from '../auth/tokens.service';
import { parseUserAgent } from '../common/user-agent';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokens: TokensService
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
  async updateMe(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<UserDto> {
    const input = updateUserRequestSchema.parse(body);

    return userDtoSchema.parse(await this.usersService.update(user.id, input));
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
    @Headers('x-postroll-refresh-token') currentRefreshToken?: string
  ): Promise<void> {
    const input = changePasswordRequestSchema.parse(body);
    await this.usersService.changePassword(user.id, input.currentPassword, input.newPassword);

    if (input.revokeOtherSessions) {
      await this.tokens.revokeOtherFamilies(user.id, currentRefreshToken);
    }
  }

  @Get('me/sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(
    @CurrentUser() user: RequestUser,
    @Headers('x-postroll-refresh-token') currentRefreshToken?: string
  ): Promise<SessionList> {
    const sessions = await this.tokens.listSessions(user.id);
    const currentFamilyId = currentRefreshToken ? await this.tokens.familyIdForRawToken(currentRefreshToken) : null;

    return sessionListSchema.parse(
      sessions.map((session) => {
        const ua = parseUserAgent(session.userAgent);

        return {
          browser: ua.browser,
          createdAt: session.createdAt.toISOString(),
          current: session.familyId === currentFamilyId,
          deviceType: ua.deviceType,
          id: session.familyId,
          ip: session.ip,
          label: ua.label,
          lastActiveAt: session.lastActiveAt.toISOString(),
          os: ua.os,
          userAgent: session.userAgent,
        };
      })
    );
  }

  @Delete('me/sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    const revoked = await this.tokens.revokeSession(user.id, id);

    if (revoked === 0) {
      throw new NotFoundException('Session not found');
    }
  }
}
