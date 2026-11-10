import { pixelBasedPreset, type TailwindConfig } from 'react-email';

/**
 * Hex equivalents of the UI's oklch tokens (packages/ui/src/styles/globals.css):
 * email clients don't support oklch. `muted-foreground` is a shade darker than
 * the UI's so small footer text keeps 4.5:1 contrast.
 */
export const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        border: '#e8e8e3',
        brand: '#fdc700',
        'brand-foreground': '#733e0a',
        foreground: '#0c0c09',
        muted: '#f4f4f0',
        'muted-foreground': '#66665a',
      },
    },
  },
} satisfies TailwindConfig;
