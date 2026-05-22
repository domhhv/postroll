import {
  type RegisterRequest,
  type RegisterResponse,
  registerResponseSchema,
  type UserDto,
  usersCountResponseSchema,
  usersListResponseSchema,
} from '@postroll/contracts';
import { getServerEnv } from '@/env';

export async function getUsers(): Promise<UserDto[]> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return usersListResponseSchema.parse(await res.json());
}

export async function getUserCount(): Promise<number> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users/count`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const { count } = usersCountResponseSchema.parse(await res.json());
  return count;
}

export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export async function registerUser(
  input: RegisterRequest,
): Promise<RegisterResponse> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message =
      res.status === 409
        ? 'An account with this email already exists.'
        : `Registration failed (${res.status}).`;
    throw new GatewayError(res.status, message);
  }
  return registerResponseSchema.parse(await res.json());
}
