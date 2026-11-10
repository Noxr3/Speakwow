'use client';

import type { CSSProperties, ReactNode } from 'react';
import Carousel from '@/components/Carousel';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import type { HomeCourse } from '@/lib/study-plan';

const transparentCards = {
  '--carousel-tile': 'transparent',
  '--carousel-tile-edge': 'transparent',
  '--carousel-tile-highlight': 'transparent',
  '--carousel-tile-shadow': 'none',
  '--carousel-hover': 'none',
  '--carousel-press': 'none',
} as CSSProperties;

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
    <Carousel
      key={`${course.id}:${course.currentUnitId}`}
      label="Choose a unit"
      itemLabel="Unit"
      baseWidth="100%"
      contentHeight={284}
      frame={false}
      effect="tilt"
      fadeEdges={false}
      radius={28}
      gap={20}
      peek={0}
      indicator="counter"
      controlsPosition="bottom"
      arrows
      autoplay={false}
      loop={false}
      disabled={busy}
      initialIndex={initial}
      style={transparentCards}
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
