'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  teacher: React.ReactNode;
  startButton: (unitId: string, continuing: boolean) => React.ReactNode;
}) {
  const initial = Math.max(
    0,
    course.units.findIndex((unit) => unit.id === course.currentUnitId)
  );
  const [index, setIndex] = useState(initial);
  const viewport = useRef<HTMLDivElement>(null);
  const selected = useRef(initial);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    selected.current = initial;
    setIndex(initial);
    element.scrollTo({ left: initial * element.clientWidth, behavior: 'instant' });
  }, [initial]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.scrollTo({ left: selected.current * element.clientWidth, behavior: 'instant' });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const move = (delta: number) => {
    if (busy) return;
    const element = viewport.current;
    if (!element) return;
    const next = Math.max(0, Math.min(course.units.length - 1, index + delta));
    element.scrollTo({
      left: next * element.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  if (!course.units.length) return null;
  return (
    <section
      aria-label="Choose a unit"
      aria-roledescription="carousel"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      <LiquidGlass radius={28} tint={0.88}>
        <div className="flex items-center justify-between px-4 pt-3">
          <button
            aria-label="Previous unit"
            disabled={busy || index === 0}
            onClick={() => move(-1)}
            className="text-muted-foreground hover:text-foreground flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-25"
          >
            <ChevronLeft size={18} />
          </button>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-muted-foreground text-xs tabular-nums"
          >
            Unit {index + 1} / {course.units.length}
          </p>
          <button
            aria-label="Next unit"
            disabled={busy || index === course.units.length - 1}
            onClick={() => move(1)}
            className="text-muted-foreground hover:text-foreground flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-25"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div
          ref={viewport}
          className={`unit-carousel flex snap-x snap-mandatory overscroll-x-contain ${busy ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
          onScroll={(event) => {
            const element = event.currentTarget;
            if (!element.clientWidth) return;
            const next = Math.max(
              0,
              Math.min(
                course.units.length - 1,
                Math.round(element.scrollLeft / element.clientWidth)
              )
            );
            selected.current = next;
            setIndex(next);
          }}
        >
          {course.units.map((unit, unitIndex) => (
            <div
              key={unit.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Unit ${unit.position}: ${unit.title}`}
              aria-hidden={unitIndex !== index}
              inert={unitIndex !== index}
              className="w-full shrink-0 snap-center snap-always px-6 pt-3 pb-3 text-center sm:px-8"
            >
              <h2 className="flex min-h-14 items-center justify-center text-lg leading-relaxed font-medium">
                {unit.title}
              </h2>
              <div className="mt-6 flex justify-center">
                {startButton(unit.id, unit.id === course.currentUnitId)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center pb-4">{teacher}</div>
      </LiquidGlass>
    </section>
  );
}
