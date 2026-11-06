export function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value.trim() : '';
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function formatDevice({ browser, os }: { browser: string | null; os: string | null }): string {
  if (browser && os) {
    return `${browser} (${os})`;
  }

  return browser ?? os ?? 'Unknown device';
}

export function countryName(code: string): string {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Berlin, BE, Germany" — whichever parts are known. */
export function formatLocation({
  city,
  country,
  region,
}: {
  city: string | null;
  country: string | null;
  region: string | null;
}) {
  const parts = [city, region, country ? countryName(country) : null].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(', ') : null;
}

export function noop() {
  return () => {};
}

export function formatRole(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function getMemberDisplayName({
  email,
  name,
  username,
}: {
  email: string;
  name: string | null;
  username: string | null;
}): string {
  return name ?? username ?? email;
}
