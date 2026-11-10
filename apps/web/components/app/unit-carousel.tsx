'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import DepthCarousel from '@/components/DepthCarousel';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { type HomeCourse, completedSessions } from '@/lib/study-plan';

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
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState(424);
  // Natural, untransformed height accommodates larger text and wrapping.
  useEffect(() => {
    const measure = () =>
      setHeight(Math.ceil(Math.max(0, ...contentRefs.current.map((el) => el?.offsetHeight ?? 0))));
    const observer = new ResizeObserver(measure);
    contentRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    measure();
    return () => observer.disconnect();
  }, [course]);
  if (!course.units.length) return null;

  return (
    <>
      <DepthCarousel
        key={course.id + ':' + course.currentUnitId}
        cardWidth={560}
        cardHeight={height}
        radius={32}
        depth={220}
        spread={64}
        tilt={12}
        visibleCards={2}
        blur={4}
        duration={480}
        showIndicators={false}
        autoplay={false}
        loop={false}
        disabled={busy}
        initialIndex={initial}
        items={course.units.map((unit, index) => {
          const done = completedSessions(unit.sessions, unit.progress);
          return (
            <LiquidGlass key={unit.id} radius={32} tint={0.88} height="100%">
              <article className="lesson-card">
                <div
                  className="lesson-card-content"
                  ref={(el) => {
                    contentRefs.current[index] = el;
                  }}
                >
                  <p className="text-muted-foreground text-sm font-medium tabular-nums">
                    Unit {index + 1} of {course.units.length}
                  </p>
                  <h2 className="lesson-title">{unit.title}</h2>
                  {unit.description && <p className="lesson-description">{unit.description}</p>}
                  <div className="lesson-footer">
                    <div className="mb-5">
                      <p className="text-muted-foreground mb-2 text-sm tabular-nums">
                        {done} of {unit.sessions.length}{' '}
                        {unit.sessions.length === 1 ? 'session' : 'sessions'} complete
                      </p>
                      <progress
                        className="study-progress w-full"
                        value={done}
                        max={unit.sessions.length || 1}
                        aria-label={unit.title + ' progress'}
                      />
                    </div>
                    {startButton(unit.id, unit.id === course.currentUnitId && course.started)}
                  </div>
                </div>
              </article>
            </LiquidGlass>
          );
        })}
      />
      <div className="mt-6 flex justify-center">{teacher}</div>
    </>
  );
}
