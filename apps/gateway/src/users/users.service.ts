import { Injectable } from '@nestjs/common';
import type { UserDto } from '@postroll/contracts';
import type { PrismaClient } from '@postroll/database/prisma';
import { InjectPrisma } from '../database/database.module';
import { toUserDto } from './toUserDto';

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async getAll(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({ omit: { password: true } });
    return users.map(toUserDto);
  }

  getCount(): Promise<number> {
    return this.prisma.user.count();
  }
}
