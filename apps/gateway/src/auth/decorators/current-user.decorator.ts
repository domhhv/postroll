import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type RequestUser = { id: string };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  // Set by JwtAuthGuard after verifying the access token.
  const request = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();

  return request.user;
});
