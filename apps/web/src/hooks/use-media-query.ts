import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks a CSS media query. Returns `serverValue` during SSR and hydration,
 * then the live match on the client.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);

      return () => {
        return media.removeEventListener('change', onChange);
      };
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => {
      return window.matchMedia(query).matches;
    },
    () => {
      return serverValue;
    }
  );
}
