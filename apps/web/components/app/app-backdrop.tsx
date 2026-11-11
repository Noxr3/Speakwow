'use client';

import { useReducedMotion } from 'motion/react';
import Aurora from '@/components/Aurora';

export function AppBackdrop({ muted = false }: { muted?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-hidden="true" className="bg-background pointer-events-none fixed inset-0 -z-10">
      <Aurora
        direction="bottom"
        colorStops={['#0b6653', '#00d79a', '#168e9f']}
        paused={reduceMotion ?? false}
        speed={0.25}
        height={0.55}
        opacity={muted ? 0.16 : 0.38}
        mouseInteraction={false}
      />
    </div>
  );
}
