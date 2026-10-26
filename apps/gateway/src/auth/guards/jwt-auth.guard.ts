import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@postroll/database/prisma';
import type { Request } from 'express';

import { InjectPrisma } from '../../database/database.module.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';

type AccessTokenPayload = { sid?: unknown; sub?: unknown };

/** Returns the token from an `Authorization: Bearer <token>` header, or null. */
function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token, ...rest] = header?.trim().split(/\s+/) ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

/**
 * Verifies the access JWT (signature + `exp`, using the `JwtModule` secret),
 * checks that its session hasn't been terminated, and exposes
 * `{ id, sessionId }` on `req.user` for `@CurrentUser()` and `WorkspaceGuard`.
 *
 * Tokens without a `sid` were issued before it existed. They're accepted
 * unchecked so a deploy doesn't log everyone out (rejecting them would force a
 * refresh mid-render, where the web app can't persist the rotated cookie).
 * They expire within JWT_ACCESS_TTL — drop this fallback after that.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectPrisma() private readonly prisma: PrismaClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const token = extractBearerToken(request.get('authorization'));

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    const { sid, sub } = payload;

    if (typeof sub !== 'string' || sub.length === 0) {
      throw new UnauthorizedException();
    }

    // TODO: remove once pre-`sid` access tokens have expired (see above).
    if (sid === undefined) {
      request.user = { id: sub, sessionId: null };

      return true;
    }

    if (typeof sid !== 'string' || sid.length === 0) {
      throw new UnauthorizedException();
    }

    // A session is live while its family still has an unrevoked, unexpired
    // token (rotation swaps tokens in one transaction, so there's no gap).
    const live = await this.prisma.refreshToken.findFirst({
      select: { id: true },
      where: { expiresAt: { gt: new Date() }, familyId: sid, revokedAt: null, userId: sub },
    });

    if (!live) {
      throw new UnauthorizedException('Session terminated');
    }

    request.user = { id: sub, sessionId: sid };

    return true;
  }
}
