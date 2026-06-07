import { createHash, randomUUID, randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@postroll/database/prisma';

import { InjectPrisma } from '../database/database.module';

export type RefreshTokenMeta = {
  ip?: string | undefined;
  userAgent?: string | undefined;
};

export type IssuedRefreshToken = {
  expiresAt: Date;
  familyId: string;
  token: string;
};

export type RotatedTokens = {
  accessToken: string;
  expiresAt: Date;
  refreshToken: string;
};

/**
 * One active login, derived by collapsing a token family. `createdAt` is the
 * family's first token (initial login); `lastActiveAt` and the UA/IP come from
 * its most recent token.
 */
export type SessionSummary = {
  createdAt: Date;
  familyId: string;
  ip: string | null;
  lastActiveAt: Date;
  userAgent: string | null;
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
    private readonly config: ConfigService
  ) {}

  signAccessToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  async issueRefreshToken(
    userId: string,
    opts: { familyId?: string } & RefreshTokenMeta = {}
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    const familyId = opts.familyId ?? randomUUID();
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.refreshToken.create({
      data: {
        expiresAt,
        familyId,
        ip: opts.ip ?? null,
        tokenHash,
        userAgent: opts.userAgent ?? null,
        userId,
      },
    });

    return { expiresAt, familyId, token };
  }

  async rotateRefreshToken(rawToken: string, meta: RefreshTokenMeta = {}): Promise<RotatedTokens> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt !== null) {
      const withinGrace = Date.now() - row.revokedAt.getTime() <= ROTATION_GRACE_MS;

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
      data: { revokedAt: new Date() },
      where: { familyId, revokedAt: null },
    });
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.refreshToken.findUnique({
      select: { familyId: true },
      where: { tokenHash },
    });

    if (row) {
      await this.revokeFamily(row.familyId);
    }
  }

  /**
   * Revokes every active refresh token for the user except the family the
   * given raw token belongs to. When the token is missing or unknown, all of
   * the user's tokens are revoked.
   */
  async revokeOtherFamilies(userId: string, keepRawToken: string | undefined): Promise<void> {
    let keepFamilyId: string | undefined;

    if (keepRawToken) {
      const row = await this.prisma.refreshToken.findUnique({
        select: { familyId: true },
        where: { tokenHash: this.hash(keepRawToken) },
      });
      keepFamilyId = row?.familyId;
    }

    await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        userId,
        ...(keepFamilyId ? { familyId: { not: keepFamilyId } } : {}),
      },
    });
  }

  /**
   * Active sessions for a user: one entry per token family that still has at
   * least one live (non-revoked, unexpired) token. Newest-active first.
   */
  async listSessions(userId: string): Promise<SessionSummary[]> {
    const rows = await this.prisma.refreshToken.findMany({
      orderBy: { createdAt: 'asc' },
      where: { expiresAt: { gt: new Date() }, revokedAt: null, userId },
      select: {
        createdAt: true,
        familyId: true,
        ip: true,
        userAgent: true,
      },
    });

    const families = new Map<string, SessionSummary>();

    for (const row of rows) {
      const existing = families.get(row.familyId);

      if (!existing) {
        families.set(row.familyId, {
          createdAt: row.createdAt,
          familyId: row.familyId,
          ip: row.ip,
          lastActiveAt: row.createdAt,
          userAgent: row.userAgent,
        });
        continue;
      }

      // rows are ascending by createdAt, so each later row is the newer activity.
      existing.lastActiveAt = row.createdAt;
      existing.userAgent = row.userAgent;
      existing.ip = row.ip;
    }

    return [...families.values()].sort((a, b) => {
      return b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
    });
  }

  /** Resolve a raw refresh token to its owning family id, if it exists. */
  async familyIdForRawToken(rawToken: string): Promise<string | null> {
    const row = await this.prisma.refreshToken.findUnique({
      select: { familyId: true },
      where: { tokenHash: this.hash(rawToken) },
    });

    return row?.familyId ?? null;
  }

  /**
   * Revoke a single session (token family) belonging to the user. Scoped by
   * userId so one user can't revoke another's family by guessing an id.
   * Returns the number of tokens revoked (0 if the family wasn't theirs).
   */
  async revokeSession(userId: string, familyId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: { familyId, revokedAt: null, userId },
    });

    return count;
  }

  private async rotateRow(
    row: { familyId: string; id: string; userId: string },
    meta: RefreshTokenMeta
  ): Promise<RotatedTokens> {
    const issued = await this.prisma.$transaction(async (tx) => {
      const next = randomBytes(32).toString('base64url');
      const nextHash = this.hash(next);
      const expiresAt = this.computeRefreshExpiry();
      const created = await tx.refreshToken.create({
        data: {
          expiresAt,
          familyId: row.familyId,
          ip: meta.ip ?? null,
          tokenHash: nextHash,
          userAgent: meta.userAgent ?? null,
          userId: row.userId,
        },
      });

      const { count } = await tx.refreshToken.updateMany({
        data: { replacedById: created.id, revokedAt: new Date() },
        where: { id: row.id, revokedAt: null },
      });

      if (count !== 1) {
        throw new UnauthorizedException('Refresh token rotation conflict');
      }

      return { expiresAt, token: next };
    });

    return {
      accessToken: this.signAccessToken(row.userId),
      expiresAt: issued.expiresAt,
      refreshToken: issued.token,
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
