'use client';

import GlassSurface from '@/components/GlassSurface';
import { cn } from '@/lib/shadcn/utils';

interface LiquidGlassProps {
  children?: React.ReactNode;
  /** px; 999 for a pill */
  radius?: number;
  /**
   * Darkening behind the content, 0 to 1. Buttons and pills stay clear (0);
   * panels with text get a little so the words read over moving light.
   */
  tint?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
}

/**
 * The one glass in Speakwow, tuned like the home page's "Start talking"
 * button: a clear centre, edges that refract what is behind with a red /
 * green / blue split, and a soft white inner rim. Chromium renders the real
 * refraction; Safari and Firefox get GlassSurface's frosted fallback.
 */
export function LiquidGlass({
  children,
  radius = 28,
  tint = 0,
  width = '100%',
  height = 'auto',
  className,
  contentClassName,
  style,
}: LiquidGlassProps) {
  return (
    <GlassSurface
      width={width}
      height={height}
      borderRadius={radius}
      backgroundOpacity={tint}
      displace={0.5}
      distortionScale={-180}
      redOffset={70}
      greenOffset={10}
      blueOffset={20}
      brightness={50}
      opacity={0.63}
      mixBlendMode="screen"
      forceDark
      className={className}
      contentClassName={cn('block', contentClassName)}
      style={style}
    >
      {children}
    </GlassSurface>
  );
}
