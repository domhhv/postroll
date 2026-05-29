import type { CSSProperties } from 'react';
import '../styles/hourglass-loader.css';

type HourglassLoaderProps = {
  size?: number;
  color?: string;
  speed?: number;
  bgOpacity?: number;
};

export function HourglassLoader({
  size = 20,
  color = 'var(--primary-foreground)',
  speed = 1.75,
  bgOpacity = 0.1,
}: HourglassLoaderProps) {
  return (
    <div
      className="hourglass-loader-container"
      style={
        {
          '--uib-size': `${size}px`,
          '--uib-color': color,
          '--uib-speed': `${speed}s`,
          '--uib-bg-opacity': bgOpacity,
        } as CSSProperties
      }
    >
      <div className="hourglass-loader-half"></div>
      <div className="hourglass-loader-half"></div>
    </div>
  );
}
