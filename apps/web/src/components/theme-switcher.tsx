'use client';

import { ToggleGroup, ToggleGroupItem } from '@postroll/ui/components/toggle-group';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { noop } from '#lib/utils';

const themes = [
  { icon: IconSun, label: 'Light', value: 'light' },
  { icon: IconDeviceDesktop, label: 'System', value: 'system' },
  { icon: IconMoon, label: 'Dark', value: 'dark' },
] as const;

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();
  // The stored theme is only known on the client; render nothing selected until then.
  const isClient = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );

  return (
    <ToggleGroup
      size="sm"
      spacing={0}
      variant="outline"
      aria-label="Theme"
      value={isClient && theme ? [theme] : []}
      onValueChange={(value: string[]) => {
        const [next] = value;

        // Ignore deselecting the active item so one theme always stays selected.
        if (next) {
          setTheme(next);
        }
      }}
    >
      {themes.map(({ icon: Icon, label, value }) => (
        <ToggleGroupItem key={value} value={value} title={label} aria-label={label}>
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
