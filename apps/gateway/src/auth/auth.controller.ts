import {
  Req,
  Res,
  Body,
  Post,
  HttpCode,
  UseGuards,
  Controller,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type LoginResponse,
  loginRequestSchema,
  loginResponseSchema,
  type RefreshResponse,
  type RegisterResponse,
  refreshResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
} from '@postroll/contracts';
import type { Request, Response, CookieOptions } from 'express';

import { AuthService, type AuthenticatedUser } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { TokensService } from './tokens.service';

const REFRESH_COOKIE = 'postroll_rt';

/** Set by the web app (which terminates the browser TLS) to relay the real client IP. */
const CLIENT_IP_HEADER = 'x-postroll-client-ip';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokens: TokensService,
    private readonly config: ConfigService
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown): Promise<RegisterResponse> {
    const input = registerRequestSchema.parse(body);

    return registerResponseSchema.parse(await this.authService.register(input));
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    loginRequestSchema.parse(body);
    const user = req.user as AuthenticatedUser;
    const result = await this.authService.login(user, {
      ip: req.get(CLIENT_IP_HEADER) ?? req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions());

    return loginResponseSchema.parse({
      accessToken: result.accessToken,
      activeWorkspaceId: result.activeWorkspaceId,
      user: result.user,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<RefreshResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE];

    if (typeof raw !== 'string' || raw.length === 0) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const rotated = await this.tokens.rotateRefreshToken(raw, {
      ip: req.get(CLIENT_IP_HEADER) ?? req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.cookie(REFRESH_COOKIE, rotated.refreshToken, this.cookieOptions());

    return refreshResponseSchema.parse({ accessToken: rotated.accessToken });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE];

    if (typeof raw === 'string' && raw.length > 0) {
      await this.tokens.revokeByRawToken(raw);
    }

    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      maxAge: this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400 * 1000,
      path: '/auth',
      sameSite: 'lax',
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
    };
  }
}
