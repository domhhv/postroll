import type { ZodType, output as zOutput } from 'zod';

import { formatZodEnvError } from './format.js';
import { loadEnvFile } from './load.js';

export type ValidateEnvOptions = {
  contextLabel?: string;
  envFileRelativePath?: string;
  exampleHint?: string;
  importMetaUrl?: string;
  source?: Record<string, unknown>;
};

export function validateEnv<S extends ZodType>(schema: S, options: ValidateEnvOptions = {}): zOutput<S> {
  const { contextLabel, envFileRelativePath, exampleHint, importMetaUrl, source } = options;

  if (importMetaUrl) {
    loadEnvFile({
      importMetaUrl,
      ...(envFileRelativePath !== undefined && {
        relativePath: envFileRelativePath,
      }),
    });
  }

  const result = schema.safeParse(source ?? process.env);

  if (!result.success) {
    const message = formatZodEnvError(result.error, {
      ...(contextLabel !== undefined && { contextLabel }),
      ...(exampleHint !== undefined && { exampleHint }),
    });
    process.stderr.write(`\n${message}\n\n`);
    process.exit(1);
  }

  return result.data;
}

export { formatZodEnvError } from './format.js';
export { loadEnvFile } from './load.js';
export { z } from 'zod';
