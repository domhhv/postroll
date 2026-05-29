import { z } from 'zod';

export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type UserDto = z.infer<typeof userDtoSchema>;

export const updateUserRequestSchema = z
  .object({
    email: z.email(),
    name: z.string().trim().min(1).max(120).nullable(),
    username: z.string().trim().min(1).max(60).nullable(),
  })
  .partial();

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
