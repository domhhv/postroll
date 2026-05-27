import { z } from 'zod';

export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type UserDto = z.infer<typeof userDtoSchema>;
