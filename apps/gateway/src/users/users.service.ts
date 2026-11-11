import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { UserDto, UpdateUserRequest } from '@postroll/contracts';
import type { Prisma, PrismaClient } from '@postroll/database/prisma';
import { hash, compare } from 'bcryptjs';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { InjectPrisma } from '../database/database.module.js';

import { toUserDto } from './toUserDto.js';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    @InjectPinoLogger(UsersService.name) private readonly logger: PinoLogger
  ) {}

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

  /**
   * Delete the user and every workspace they own. Their memberships in other
   * workspaces and their refresh tokens go with the user row via
   * `onDelete: Cascade`, which also ends all of their sessions. Their outbox
   * events go too: those hold a copy of the email address, and a pending one
   * would otherwise still be sent by the sweep.
   */
  async remove(id: string): Promise<void> {
    const [workspaces, outboxEvents] = await this.prisma.$transaction([
      this.prisma.workspace.deleteMany({ where: { members: { some: { role: 'OWNER', userId: id } } } }),
      this.prisma.outboxEvent.deleteMany({ where: { payload: { equals: id, path: ['data', 'userId'] } } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    this.logger.info(
      { outboxEventsDeleted: outboxEvents.count, userId: id, workspacesDeleted: workspaces.count },
      'Account deleted'
    );
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
