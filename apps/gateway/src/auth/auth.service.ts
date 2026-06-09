import { Injectable, ConflictException } from '@nestjs/common';
import type { UserDto, LoginResponse, RegisterRequest } from '@postroll/contracts';
import type { User, PrismaClient } from '@postroll/database/prisma';
import { hash, compare } from 'bcryptjs';

import { InjectPrisma } from '../database/database.module';
import { toUserDto } from '../users/toUserDto';
import { generateWorkspaceSlug } from '../workspaces/slug';

import { TokensService } from './tokens.service';

export type AuthenticatedUser = Omit<User, 'password'>;

export type LoginWithRefresh = LoginResponse & {
  refreshExpiresAt: Date;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  BCRYPT_COST = 12;

  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly tokens: TokensService
  ) {}

  async register(input: RegisterRequest): Promise<UserDto> {
    const passwordHash = await hash(input.password, this.BCRYPT_COST);
    const workspaceName = `${this.defaultWorkspaceLabel(input.email)}'s Workspace`;

    try {
      /**
       * Create the user, their personal workspace, and the owner membership
       * atomically — a half-registered user with no workspace would break
       * every workspace-scoped flow downstream.
       *
       * No email infrastructure yet, so we auto-verify on signup. When email
       * verification lands (Phase B), drop `emailVerifiedAt` here and gate it
       * behind a confirmation link instead.
       */
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            emailVerifiedAt: new Date(),
            password: passwordHash,
          },
        });

        await tx.workspace.create({
          data: {
            name: workspaceName,
            slug: generateWorkspaceSlug(workspaceName),
            members: {
              create: {
                role: 'OWNER',
                userId: created.id,
              },
            },
          },
        });

        return created;
      });

      return toUserDto(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  /** Local-part of the email, used to label the auto-created workspace. */
  private defaultWorkspaceLabel(email: string): string {
    const localPart = email.split('@')[0]?.trim();

    return localPart && localPart.length > 0 ? localPart : 'My';
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    const ok = await compare(password, user.password);

    if (!ok) {
      return null;
    }

    const { password: _password, ...rest } = user;

    return rest;
  }

  async login(
    user: AuthenticatedUser,
    meta: { ip?: string | undefined; userAgent?: string | undefined } = {}
  ): Promise<LoginWithRefresh> {
    const accessToken = this.tokens.signAccessToken(user.id);
    const refresh = await this.tokens.issueRefreshToken(user.id, meta);
    const activeWorkspaceId = await this.defaultWorkspaceId(user.id);

    return {
      accessToken,
      activeWorkspaceId,
      refreshExpiresAt: refresh.expiresAt,
      refreshToken: refresh.token,
      user: toUserDto(user),
    };
  }

  /**
   * The workspace a fresh session opens into: the user's oldest membership.
   * Every user gets an owner workspace at registration, so this is always
   * present for accounts created through the normal flow.
   */
  private async defaultWorkspaceId(userId: string): Promise<string> {
    const membership = await this.prisma.membership.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
      where: { userId },
    });

    if (!membership) {
      throw new Error(`User ${userId} has no workspace membership`);
    }

    return membership.workspaceId;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'P2002'
    );
  }
}
