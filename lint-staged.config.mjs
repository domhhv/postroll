const config = {
  '**/package.json': 'sort-package-json',
  '**/*.{md,js,jsx,ts,tsx}': () => ['pnpm lint', 'pnpm prettier:check'],
  '**/*.{ts,tsx}': () => 'pnpm check-types',
};

export default config;
