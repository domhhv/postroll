import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@postroll/database/prisma';
import { InjectPrisma } from '../database/database.module';

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  getAll() {
    return this.prisma.user.findMany();
  }

  getCount() {
    return this.prisma.user.count();
  }
}
