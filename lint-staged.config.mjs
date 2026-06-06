const config = {
  '**/package.json': 'sort-package-json',
  '**/*.{md,js,jsx,ts,tsx}': () => {
    return ['pnpm lint', 'pnpm prettier:check'];
  },
  '**/*.{ts,tsx}': () => {
    return 'pnpm check-types';
  },
};

export default config;
