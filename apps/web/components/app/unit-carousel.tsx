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
    <>
      <DepthCarousel
        key={`${course.id}:${course.currentUnitId}`}
        cardWidth={384}
        cardHeight={320}
        radius={28}
        depth={220}
        spread={90}
        tilt={22}
        visibleCards={3}
        blur={3}
        duration={650}
        showIndicators={false}
        autoplay={false}
        loop={false}
        disabled={busy}
        initialIndex={initial}
        items={course.units.map((unit, index) => (
          <LiquidGlass key={unit.id} radius={28} tint={0.88} height="100%">
            <div className="flex h-full flex-col items-center px-6 py-7 text-center sm:px-8">
              <p className="text-xs text-white/55 tabular-nums">
                Unit {index + 1} / {course.units.length}
              </p>
              <h2 className="mt-3 text-lg leading-relaxed font-medium">{unit.title}</h2>
              {unit.description && (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/65">
                  {unit.description}
                </p>
              )}
              <div className="mt-auto flex justify-center pt-6">
                {startButton(unit.id, unit.id === course.currentUnitId)}
              </div>
            </div>
          </LiquidGlass>
        ))}
      />
      <div className="flex justify-center">{teacher}</div>
    </>
  );
}
