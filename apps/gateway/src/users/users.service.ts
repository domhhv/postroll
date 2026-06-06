import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { UserDto, UpdateUserRequest } from '@postroll/contracts';
import type { Prisma, PrismaClient } from '@postroll/database/prisma';
import { hash, compare } from 'bcryptjs';

import { InjectPrisma } from '../database/database.module';

import { toUserDto } from './toUserDto';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({
      omit: { password: true },
      where: { id },
    });

    return user ? toUserDto(user) : null;
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserDto> {
    const data: Prisma.UserUpdateInput = {};

    if (input.email !== undefined) {
      data.email = input.email;
    }

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.username !== undefined) {
      data.username = input.username;
    }

    try {
      const user = await this.prisma.user.update({
        data,
        omit: { password: true },
        where: { id },
      });

      return toUserDto(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user || !(await compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const password = await hash(newPassword, BCRYPT_COST);
    await this.prisma.user.update({ data: { password }, where: { id } });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'P2002'
    );
  }
}
