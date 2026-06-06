import { Injectable, ConflictException } from '@nestjs/common';
import type { UserDto, LoginResponse, RegisterRequest } from '@postroll/contracts';
import type { User, PrismaClient } from '@postroll/database/prisma';
import { hash, compare } from 'bcryptjs';

import { InjectPrisma } from '../database/database.module';
import { toUserDto } from '../users/toUserDto';

import { TokensService } from './tokens.service';

export type AuthenticatedUser = Omit<User, 'password'>;

export type LoginWithRefresh = LoginResponse & {
  refreshExpiresAt: Date;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  BCRYPT_COST = 12;

  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly tokens: TokensService
  ) {}

  async register(input: RegisterRequest): Promise<UserDto> {
    const passwordHash = await hash(input.password, this.BCRYPT_COST);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          password: passwordHash,
        },
      });

      return toUserDto(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    const ok = await compare(password, user.password);

    if (!ok) {
      return null;
    }

    const { password: _password, ...rest } = user;

    return rest;
  }

  async login(
    user: AuthenticatedUser,
    meta: { ip?: string | undefined; userAgent?: string | undefined } = {}
  ): Promise<LoginWithRefresh> {
    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueRefreshToken(user.id, meta);

    return {
      accessToken,
      refreshExpiresAt: refresh.expiresAt,
      refreshToken: refresh.token,
      user: toUserDto(user),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'P2002'
    );
  }
}
