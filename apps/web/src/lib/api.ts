import type { User } from '@postroll/database';
import { getServerEnv } from '@/env';

export async function getUsers(): Promise<User[]> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return res.json();
}

export async function getUserCount(): Promise<number> {
  const { GATEWAY_URL } = getServerEnv();
  console.log('Fetching user count from gateway, GATEWAY_URL: ', GATEWAY_URL);
  const res = await fetch(`${GATEWAY_URL}/users/count`);
  const { count } = (await res.json()) as { count: number };
  return count;
}
