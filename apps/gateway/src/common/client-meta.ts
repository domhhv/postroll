import type { Request } from 'express';

/**
 * Headers set by the web app (which terminates the browser request) to relay
 * the real client's IP and approximate location. The gateway is internal-only,
 * so these can't be spoofed by browsers directly.
 */
export const CLIENT_IP_HEADER = 'x-postroll-client-ip';
export const CLIENT_CITY_HEADER = 'x-postroll-client-city';
export const CLIENT_REGION_HEADER = 'x-postroll-client-region';
export const CLIENT_COUNTRY_HEADER = 'x-postroll-client-country';

const MAX_PLACE_LENGTH = 100;

export type ClientLocation = {
  city?: string | undefined;
  /** ISO 3166-1 alpha-2, upper-case. */
  country?: string | undefined;
  region?: string | undefined;
};

export type ClientMeta = ClientLocation & {
  ip?: string | undefined;
  userAgent?: string | undefined;
};

/**
 * Free-text place names (Vercel URI-encodes `x-vercel-ip-city` because it may
 * contain non-ASCII). Decode leniently, trim and bound the length.
 */
function readPlace(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  let value = raw;

  try {
    value = decodeURIComponent(raw);
  } catch {
    // Not URI-encoded (or malformed) — keep the raw value.
  }

  value = value.trim();

  return value.length > 0 && value.length <= MAX_PLACE_LENGTH ? value : undefined;
}

function readCountry(raw: string | undefined): string | undefined {
  const value = raw?.trim().toUpperCase();

  return value && /^[A-Z]{2}$/.test(value) ? value : undefined;
}

export function readClientMeta(req: Request): ClientMeta {
  return {
    city: readPlace(req.get(CLIENT_CITY_HEADER)),
    country: readCountry(req.get(CLIENT_COUNTRY_HEADER)),
    ip: req.get(CLIENT_IP_HEADER) ?? req.ip,
    region: readPlace(req.get(CLIENT_REGION_HEADER)),
    userAgent: req.get('user-agent') ?? undefined,
  };
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** "Berlin, Germany" / "Germany" / null — a display-ready line for the sessions list. */
export function formatLocation(location: {
  city: string | null;
  country: string | null;
  region: string | null;
}): string | null {
  let country: string | null = null;

  if (location.country) {
    try {
      country = countryNames.of(location.country) ?? location.country;
    } catch {
      country = location.country;
    }
  }

  const parts = [location.city, country].filter((part): part is string => {
    return Boolean(part);
  });

  return parts.length > 0 ? parts.join(', ') : null;
}
