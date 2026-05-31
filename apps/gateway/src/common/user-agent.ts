import Bowser from 'bowser';

export type ParsedUserAgent = {
  /** Friendly browser name, e.g. "Chrome". */
  browser: string | null;
  /** Friendly OS name, e.g. "macOS". */
  os: string | null;
  /** "desktop" | "mobile" | "tablet" | etc., when known. */
  deviceType: string | null;
  /** A single human-readable line, e.g. "Chrome 148 on macOS". */
  label: string;
};

/**
 * Turn a raw User-Agent header into friendly, display-ready fields.
 *
 * The legacy UA string interleaves compatibility tokens (AppleWebKit, KHTML,
 * Safari, Chrome…) for one browser, so it can't be read by eye — bowser's
 * heuristic database resolves the actual browser/OS. A missing or unparseable
 * UA yields a "Unknown device" label rather than throwing.
 */
export function parseUserAgent(
  raw: string | null | undefined,
): ParsedUserAgent {
  if (!raw) {
    return {
      browser: null,
      os: null,
      deviceType: null,
      label: 'Unknown device',
    };
  }

  const parsed = Bowser.parse(raw);
  const browser = parsed.browser.name ?? null;
  const browserVersion = parsed.browser.version ?? null;
  const os = parsed.os.name ?? null;
  const deviceType = parsed.platform.type ?? null;

  if (!browser && !os) {
    return { browser: null, os: null, deviceType, label: 'Unknown device' };
  }

  const browserLabel = browser
    ? // Keep only the major version (e.g. 148.0.0.0 -> 148) for a tidy label.
      [browser, browserVersion?.split('.')[0]].filter(Boolean).join(' ')
    : null;
  const label =
    [browserLabel, os].filter(Boolean).join(' on ') || 'Unknown device';

  return { browser, os, deviceType, label };
}
