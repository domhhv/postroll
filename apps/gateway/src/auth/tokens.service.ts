import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the decorator
import { ConfigService } from '@nestjs/config';
// biome-ignore lint/style/useImportType: needed for the decorator
import { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@postroll/database/prisma';
import { InjectPrisma } from '../database/database.module';

export type RefreshTokenMeta = {
  userAgent?: string | undefined;
  ip?: string | undefined;
};

export type IssuedRefreshToken = {
  token: string;
  familyId: string;
  expiresAt: Date;
};

export type RotatedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

@Injectable()
export class TokensService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  async issueRefreshToken(
    userId: string,
    opts: { familyId?: string } & RefreshTokenMeta = {},
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    const familyId = opts.familyId ?? randomUUID();
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        expiresAt,
        userAgent: opts.userAgent ?? null,
        ip: opts.ip ?? null,
      },
    });

    return { token, familyId, expiresAt };
  }

  async rotateRefreshToken(
    rawToken: string,
    meta: RefreshTokenMeta = {},
  ): Promise<RotatedTokens> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt !== null) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const issued = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count !== 1) {
        throw new UnauthorizedException('Refresh token rotation conflict');
      }

      const next = randomBytes(32).toString('base64url');
      const nextHash = this.hash(next);
      const expiresAt = this.computeRefreshExpiry();
      await tx.refreshToken.create({
        data: {
          userId: row.userId,
          tokenHash: nextHash,
          familyId: row.familyId,
          expiresAt,
          userAgent: meta.userAgent ?? null,
          ip: meta.ip ?? null,
        },
      });
      return { token: next, expiresAt };
    });

    return {
      accessToken: this.signAccessToken(row.userId),
      refreshToken: issued.token,
      expiresAt: issued.expiresAt,
    };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });
    if (row) {
      await this.revokeFamily(row.familyId);
    }
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private computeRefreshExpiry(): Date {
    const days = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    return new Date(Date.now() + days * 86_400_000);
  }
}
