import { z } from 'zod';
import { userDtoSchema } from './users.js';

export const registerRequestSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = userDtoSchema;

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: userDtoSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().default(false),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const sessionDtoSchema = z.object({
  /** The token family id; stable across refresh rotations for one login. */
  id: z.uuid(),
  /** Friendly browser name, e.g. "Chrome" (null when unknown). */
  browser: z.string().nullable(),
  /** Friendly OS name, e.g. "macOS" (null when unknown). */
  os: z.string().nullable(),
  /** "desktop" | "mobile" | "tablet" | … when known. */
  deviceType: z.string().nullable(),
  /** Single human-readable line, e.g. "Chrome 148 on macOS". */
  label: z.string(),
  /** Raw User-Agent header, kept for forensics / tooltip. */
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  /** When this session was first created (initial login). */
  createdAt: z.iso.datetime(),
  /** Last activity (most recent token issued in the family). */
  lastActiveAt: z.iso.datetime(),
  /** True for the session making the request. */
  current: z.boolean(),
});

export type SessionDto = z.infer<typeof sessionDtoSchema>;

export const sessionListSchema = z.array(sessionDtoSchema);

export type SessionList = z.infer<typeof sessionListSchema>;
