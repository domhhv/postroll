import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the decorator
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
import type { CookieOptions, Request, Response } from 'express';
// biome-ignore lint/style/useImportType: needed for the decorator
import { type AuthenticatedUser, AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
// biome-ignore lint/style/useImportType: needed for the decorator
import { TokensService } from './tokens.service';

const REFRESH_COOKIE = 'postroll_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokens: TokensService,
    private readonly config: ConfigService,
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    loginRequestSchema.parse(body);
    const user = req.user as AuthenticatedUser;
    const result = await this.authService.login(user, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return loginResponseSchema.parse({
      accessToken: result.accessToken,
      user: result.user,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const rotated = await this.tokens.rotateRefreshToken(raw, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE, rotated.refreshToken, this.cookieOptions());
    return refreshResponseSchema.parse({ accessToken: rotated.accessToken });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (typeof raw === 'string' && raw.length > 0) {
      await this.tokens.revokeByRawToken(raw);
    }
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/auth',
      maxAge:
        this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400 * 1000,
    };
  }
}
