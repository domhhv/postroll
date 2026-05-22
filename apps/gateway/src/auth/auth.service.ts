import { ConflictException, Injectable } from '@nestjs/common';
import type { RegisterRequest, UserDto } from '@postroll/contracts';
import type { PrismaClient } from '@postroll/database/prisma';
import { hash } from 'bcryptjs';
import { InjectPrisma } from '../database/database.module';
import { toUserDto } from '../users/toUserDto';

@Injectable()
export class AuthService {
  BCRYPT_COST = 12;

  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async register(input: RegisterRequest): Promise<UserDto> {
    const passwordHash = await hash(input.password, this.BCRYPT_COST);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          password: passwordHash,
        },
      });

      return toUserDto(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
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
