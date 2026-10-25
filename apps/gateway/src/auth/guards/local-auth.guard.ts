import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, type AuthenticatedUser } from '../auth.service.js';

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Checks the email/password in the request body and exposes the authenticated
 * user on `req.user` for the login handler. Missing or wrong credentials → 401.
 */
@Injectable()
export class LocalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const email = readStringField(request.body, 'email');
    const password = readStringField(request.body, 'password');

    if (!email || !password) {
      throw new UnauthorizedException();
    }

    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    request.user = user;

    return true;
  }
}
