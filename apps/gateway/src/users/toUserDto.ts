import type { UserDto } from '@postroll/contracts';
import type { User } from '@postroll/database/prisma';

export function toUserDto(user: Omit<User, 'password'>): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
  };
}
