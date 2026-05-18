import { Injectable } from '@nestjs/common';
import type { UserDto } from '@postroll/contracts';
import type { PrismaClient, User } from '@postroll/database/prisma';
import { InjectPrisma } from '../database/database.module';

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async getAll(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map(toUserDto);
  }

  getCount(): Promise<number> {
    return this.prisma.user.count();
  }
}
