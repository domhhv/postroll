const config = {
  "**/package.json": "sort-package-json",
  "**/*.{ts,tsx}": () => "pnpm check-types",
  "**/*.{md,js,jsx,ts,tsx}": () => "pnpm biome:write",
};

export default config;
