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

/**
 * Grace window during which a concurrent retry presenting the just-rotated
 * (now-revoked) token receives the replacement instead of triggering family
 * revocation. Absorbs benign races without weakening reuse detection beyond it.
 */
const ROTATION_GRACE_MS = 10_000;

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
      const withinGrace =
        Date.now() - row.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (withinGrace && row.replacedById) {
        const replacement = await this.prisma.refreshToken.findUnique({
          where: { id: row.replacedById },
        });
        if (replacement && replacement.revokedAt === null) {
          /**
           * We can't return the original plaintext token (only the hash is
           * stored), so issue another rotation off the replacement. The caller
           * ends up with a fresh token either way.
           */
          return this.rotateRow(replacement, meta);
        }
      }
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    return this.rotateRow(row, meta);
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

  private async rotateRow(
    row: { id: string; userId: string; familyId: string },
    meta: RefreshTokenMeta,
  ): Promise<RotatedTokens> {
    const issued = await this.prisma.$transaction(async (tx) => {
      const next = randomBytes(32).toString('base64url');
      const nextHash = this.hash(next);
      const expiresAt = this.computeRefreshExpiry();
      const created = await tx.refreshToken.create({
        data: {
          userId: row.userId,
          tokenHash: nextHash,
          familyId: row.familyId,
          expiresAt,
          userAgent: meta.userAgent ?? null,
          ip: meta.ip ?? null,
        },
      });

      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
      if (count !== 1) {
        throw new UnauthorizedException('Refresh token rotation conflict');
      }

      return { token: next, expiresAt };
    });

    return {
      accessToken: this.signAccessToken(row.userId),
      refreshToken: issued.token,
      expiresAt: issued.expiresAt,
    };
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private computeRefreshExpiry(): Date {
    const days = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    return new Date(Date.now() + days * 86_400_000);
  }
}
