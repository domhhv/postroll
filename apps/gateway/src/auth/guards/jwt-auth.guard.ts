import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { RequestUser } from '../decorators/current-user.decorator.js';

type AccessTokenPayload = { sub?: unknown };

/** Returns the token from an `Authorization: Bearer <token>` header, or null. */
function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token, ...rest] = header?.trim().split(/\s+/) ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

/**
 * Verifies the access JWT (signature + `exp`, using the `JwtModule` secret) and
 * exposes `{ id }` on `req.user` for `@CurrentUser()` and `WorkspaceGuard`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

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

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException();
    }

    request.user = { id: payload.sub };

    return true;
  }
}
