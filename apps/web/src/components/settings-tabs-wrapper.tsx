'use client';

import { HourglassLoader } from '@postroll/ui/components/hourglass-loader';
import { Tabs } from '@postroll/ui/components/tabs';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { useMediaQuery } from '#hooks/use-media-query';

export function SettingsTabsWrapper({ children }: PropsWithChildren) {
  const isSmUp = useMediaQuery('(min-width: 40rem)', null);
  const tab = useSelectedLayoutSegment();

  if (isSmUp === null) {
    return <HourglassLoader bgOpacity={0.5} color="var(--foreground)" />;
  }

  return (
    <Tabs value={tab} className="gap-6 sm:gap-8" orientation={isSmUp ? 'vertical' : 'horizontal'}>
      {children}
    </Tabs>
  );
}
