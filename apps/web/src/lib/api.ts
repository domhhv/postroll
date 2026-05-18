import {
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
