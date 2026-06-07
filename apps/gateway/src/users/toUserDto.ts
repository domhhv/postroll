import type { UserDto } from '@postroll/contracts';
import type { User } from '@postroll/database/prisma';

export function toUserDto(user: Omit<User, 'password'>): UserDto {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    name: user.name,
    username: user.username,
  };
}
