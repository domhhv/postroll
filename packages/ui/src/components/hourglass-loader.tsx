import type { CSSProperties } from 'react';

import '../styles/hourglass-loader.css';

type HourglassLoaderProps = {
  bgOpacity?: number;
  color?: string;
  size?: number;
  speed?: number;
};

export function HourglassLoader({
  bgOpacity = 0.1,
  color = 'var(--primary-foreground)',
  size = 20,
  speed = 1.75,
}: HourglassLoaderProps) {
  return (
    <div
      className="hourglass-loader-container"
      style={
        {
          '--uib-bg-opacity': bgOpacity,
          '--uib-color': color,
          '--uib-size': `${size}px`,
          '--uib-speed': `${speed}s`,
        } as CSSProperties
      }
    >
      <div className="hourglass-loader-half"></div>
      <div className="hourglass-loader-half"></div>
    </div>
  );
}
