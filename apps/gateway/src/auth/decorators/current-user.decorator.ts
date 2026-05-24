import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type RequestUser = { id: string };

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as RequestUser;
  },
);
