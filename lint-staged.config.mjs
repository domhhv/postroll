const config = {
  '**/*.{ts,tsx}': () => 'pnpm check-types',
  '**/*.{md,js,jsx,ts,tsx}': () => 'pnpm biome:check',
};

export default config;
