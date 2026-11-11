type Level = 'error' | 'info' | 'warn';

type Fields = Record<string, unknown>;

const sinks = { error: console.error, info: console.info, warn: console.warn } satisfies Record<
  Level,
  (line: string) => void
>;

/** Keeps `cause` and `code`: a failed `fetch` only says "fetch failed", and the reason is in its cause. */
function serialize(value: unknown): unknown {
  if (!(value instanceof Error)) {
    return value;
  }

  return {
    message: value.message,
    name: value.name,
    stack: value.stack,
    ...('code' in value && { code: value.code }),
    ...(value.cause !== undefined && { cause: serialize(value.cause) }),
  };
}

/**
 * One JSON line per call, so Vercel's log search can filter on fields, in the
 * same shape the gateway's pino logs use (`level`, `msg`, `time`). For Route
 * Handlers and Server Actions; never pass secrets or email addresses.
 */
function write(level: Level, msg: string, fields: Fields) {
  const entries = Object.entries(fields).map(([key, value]) => [key, serialize(value)]);
  sinks[level](JSON.stringify({ level, msg, time: new Date().toISOString(), ...Object.fromEntries(entries) }));
}

export const log = {
  error: (msg: string, fields: Fields = {}) => write('error', msg, fields),
  info: (msg: string, fields: Fields = {}) => write('info', msg, fields),
  warn: (msg: string, fields: Fields = {}) => write('warn', msg, fields),
};
