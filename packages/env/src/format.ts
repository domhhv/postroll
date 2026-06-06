import type { ZodError } from 'zod';

export function formatZodEnvError(
  error: ZodError,
  options: { contextLabel?: string; exampleHint?: string } = {}
): string {
  const { contextLabel, exampleHint } = options;
  const header = contextLabel ? `Invalid environment for ${contextLabel}:` : 'Invalid environment:';

  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';

    return `  • ${path} — ${issue.message}`;
  });

  const footer = exampleHint ? `\nSee ${exampleHint} for the expected variables.` : '';

  return `${header}\n${lines.join('\n')}${footer}`;
}
