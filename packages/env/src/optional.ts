import { z, type ZodType } from 'zod';

/**
 * An optional variable that also treats an empty value (`KEY=` in a .env file,
 * or a blank field in a dashboard) as unset.
 */
export function optionalEnv<T extends ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}
