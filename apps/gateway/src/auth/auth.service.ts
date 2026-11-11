import { Injectable, ConflictException } from '@nestjs/common';
import type { UserDto, LoginResponse, RegisterRequest } from '@postroll/contracts';
import type { User, PrismaClient } from '@postroll/database/prisma';
import { hash, compare } from 'bcryptjs';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { InjectPrisma } from '../database/database.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { toUserDto } from '../users/toUserDto.js';
import { generateWorkspaceSlug } from '../workspaces/slug.js';

import { TokensService, type RefreshTokenMeta } from './tokens.service.js';

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
    private readonly tokens: TokensService,
    private readonly outbox: OutboxService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger
  ) {}

  async register(input: RegisterRequest): Promise<UserDto> {
    const passwordHash = await hash(input.password, this.BCRYPT_COST);
    const workspaceName = `${this.defaultWorkspaceLabel(input.email)}'s Workspace`;

    try {
      /**
       * Create the user, their personal workspace, the owner membership and
       * the welcome email's outbox row atomically — a half-registered user
       * with no workspace would break every workspace-scoped flow downstream,
       * and the email must exist exactly when the account does.
       *
       * Email verification doesn't exist yet, so we auto-verify on signup.
       * When it lands, drop `emailVerifiedAt` here, gate it behind a
       * confirmation link, and send the welcome email after verification.
       */
      const { user, welcomeEventId } = await this.prisma.$transaction(async (tx) => {
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

        const eventId = await this.outbox.enqueue(tx, {
          data: { name: created.name, to: created.email, userId: created.id, workspaceName },
          type: 'email.welcome',
        });

        return { user: created, welcomeEventId: eventId };
      });

      this.logger.info({ userId: user.id, welcomeEventId }, 'User registered; welcome email queued in the outbox');
      this.outbox.dispatchAfterCommit([welcomeEventId]);

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

  async login(user: AuthenticatedUser, meta: RefreshTokenMeta = {}): Promise<LoginWithRefresh> {
    const refresh = await this.tokens.issueRefreshToken(user.id, meta);
    const accessToken = this.tokens.signAccessToken(user.id, refresh.familyId);
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
