import { ConflictException, Injectable } from '@nestjs/common';
import type { UpdateUserRequest, UserDto } from '@postroll/contracts';
import type { Prisma, PrismaClient } from '@postroll/database/prisma';
import { hash } from 'bcryptjs';
import { InjectPrisma } from '../database/database.module';
import { toUserDto } from './toUserDto';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    return user ? toUserDto(user) : null;
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserDto> {
    const data: Prisma.UserUpdateInput = {};
    if (input.email !== undefined) data.email = input.email;
    if (input.name !== undefined) data.name = input.name;
    if (input.username !== undefined) data.username = input.username;

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        omit: { password: true },
      });
      return toUserDto(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const password = await hash(newPassword, BCRYPT_COST);
    await this.prisma.user.update({ where: { id }, data: { password } });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
    );
  }
}
