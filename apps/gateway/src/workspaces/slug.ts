import { randomBytes } from 'node:crypto';

import slugify from 'slugify';

/** base36 alphabet keeps the suffix URL-safe and lowercase. */
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUFFIX_LENGTH = 6;

/**
 * Short random suffix appended to slugs to dodge collisions without a
 * try/retry loop — `acme-x7k2pq` instead of `acme`. Six base36 chars is ~2
 * billion combinations, plenty for a portfolio project's collision odds.
 */
function shortSuffix(): string {
  const bytes = randomBytes(SUFFIX_LENGTH);
  let out = '';

  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    out += SUFFIX_ALPHABET[bytes[i]! % SUFFIX_ALPHABET.length];
  }

  return out;
}

/**
 * Turn a workspace name into a unique-enough URL slug, e.g.
 * "Acme Hiring" -> "acme-hiring-x7k2pq". Falls back to "workspace" when the
 * name slugifies to an empty string (e.g. all emoji / punctuation).
 */
export function generateWorkspaceSlug(name: string): string {
  const base = slugify(name, { lower: true, strict: true, trim: true }) || 'workspace';

  return `${base}-${shortSuffix()}`;
}
