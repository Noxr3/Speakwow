'use client';

import Aurora from '@/components/Aurora';

export function AppBackdrop({ muted = false }: { muted?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-black">
      <Aurora speed={0.6} height={0.6} opacity={muted ? 0.4 : 1} />
    </div>
  );
}
