'use client';

import type { ReactNode } from 'react';
import DepthCarousel from '@/components/DepthCarousel';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import type { HomeCourse } from '@/lib/study-plan';

export function UnitCarousel({
  course,
  busy,
  startButton,
  teacher,
}: {
  course: HomeCourse;
  busy: boolean;
  teacher: ReactNode;
  startButton: (unitId: string, continuing: boolean) => ReactNode;
}) {
  const initial = Math.max(
    0,
    course.units.findIndex((unit) => unit.id === course.currentUnitId)
  );
  if (!course.units.length) return null;

  return (
    <DepthCarousel
      key={`${course.id}:${course.currentUnitId}`}
      cardWidth={384}
      cardHeight={284}
      radius={28}
      depth={220}
      spread={90}
      tilt={22}
      visibleCards={3}
      blur={3}
      duration={650}
      autoplay={false}
      loop={false}
      disabled={busy}
      initialIndex={initial}
      items={course.units.map((unit) => (
        <LiquidGlass key={unit.id} radius={28} tint={0.88} height="100%">
          <div className="flex h-full flex-col items-center justify-center px-6 py-5 text-center sm:px-8">
            <h2 className="flex min-h-14 items-center justify-center text-lg leading-relaxed font-medium">
              {unit.title}
            </h2>
            <div className="mt-6 flex justify-center">
              {startButton(unit.id, unit.id === course.currentUnitId)}
            </div>
            <div className="mt-4 flex justify-center">{teacher}</div>
          </div>
        </LiquidGlass>
      ))}
    />
  );
}
