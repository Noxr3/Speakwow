'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';

const Aurora = dynamic(() => import('@/components/Aurora'), { ssr: false });

export function AppBackdrop({ muted = false }: { muted?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-hidden="true" className="bg-background pointer-events-none fixed inset-0 -z-10">
      <Aurora
        direction="bottom"
        dpr={1.5}
        colorStops={['#087f63', '#00efa8', '#55d9d0']}
        paused={reduceMotion ?? false}
        speed={0.25}
        height={0.46}
        blend={0.32}
        glow={0.36}
        amplitude={1.15}
        opacity={muted ? 0.14 : 0.55}
        mouseInteraction={false}
      />
    </div>
  );
}
