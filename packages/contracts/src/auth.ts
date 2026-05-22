import { z } from 'zod';
import { userDtoSchema } from './users.js';

export const registerRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = userDtoSchema;

export type RegisterResponse = z.infer<typeof registerResponseSchema>;
