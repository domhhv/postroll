import { z } from 'zod';

export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type UserDto = z.infer<typeof userDtoSchema>;

export const usersListResponseSchema = z.array(userDtoSchema);

export type UsersListResponse = z.infer<typeof usersListResponseSchema>;

export const usersCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UsersCountResponse = z.infer<typeof usersCountResponseSchema>;
