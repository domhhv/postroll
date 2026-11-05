import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Next 16.4 regression: with the persistent Turbopack dev cache, a tab left
     * open across `next dev` restarts reloads forever (the first HMR update for
     * the entry chunk list is `restart`). Re-enable once fixed upstream.
     * https://github.com/vercel/next.js/issues/100251
     */
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
