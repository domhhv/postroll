import { useSyncExternalStore } from 'react';

import { noop } from '#lib/utils';

const localFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const utcFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

/**
 * Renders in UTC on the server (and during hydration), then switches to the
 * viewer's time zone — avoids a hydration mismatch from server/browser TZs.
 */
export function DateTime({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  const date = new Date(iso);

  return (
    <time title={iso} dateTime={iso}>
      {isClient ? localFormat.format(date) : `${utcFormat.format(date)} UTC`}
    </time>
  );
}
