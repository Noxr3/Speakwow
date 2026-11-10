'use client';

import Link from 'next/link';
import { ArrowLeftRight, Check, ChevronDown, Play } from 'lucide-react';
import type { PersonaSummary } from '@speakwow/shared';
import { AppBackdrop } from '@/components/app/app-backdrop';
import { UnitCarousel } from '@/components/app/unit-carousel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { courseLevelLabel } from '@/lib/course-categories';
import type { HomeLibrary } from '@/lib/study-plan';

interface WelcomeViewProps {
  personas: PersonaSummary[];
  persona: PersonaSummary;
  onSelectPersona: (id: string) => void;
  library: HomeLibrary;
  busy: boolean;
  onStartCall: (unitId?: string) => void;
}

export const WelcomeView = ({
  personas,
  persona,
  onSelectPersona,
  library,
  busy,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const course = library.courses.find((c) => c.id === library.selectedId);
  const startButton = (unitId?: string, continuing = false) => (
    <Button
      size="lg"
      disabled={busy}
      aria-busy={busy}
      onClick={() => onStartCall(unitId)}
      className="w-full disabled:cursor-wait"
    >
      {!busy && <Play size={18} fill="currentColor" aria-hidden="true" />}
      {busy
        ? 'Connecting…'
        : course
          ? continuing
            ? 'Continue lesson'
            : 'Start lesson'
          : 'Start talking'}
    </Button>
  );
  const teacher = (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        className="teacher-trigger"
        aria-label={'Choose a teacher, currently ' + persona.display_name}
      >
        <span className="teacher-monogram" aria-hidden="true">
          {persona.display_name[0]}
        </span>
        With {persona.display_name}
        <ChevronDown size={16} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-88 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        {personas.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => onSelectPersona(p.id)}
            className="items-start gap-3 px-3 py-3"
          >
            <span className="teacher-monogram mt-0.5" aria-hidden="true">
              {p.display_name[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.display_name}</span>
              <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                {p.tagline_en}
              </span>
            </span>
            {persona.id === p.id && (
              <Check size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div ref={ref} className="home-stage">
      <div className="home-column">
        <div className="mb-6">
          <LiquidGlass radius={28} tint={0.65}>
            <Link
              href="/courses"
              className="course-capsule"
              aria-label={course ? 'Change course, currently ' + course.title : 'Choose a course'}
            >
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs font-medium">
                  Course{course ? ' · ' + courseLevelLabel(course) : ''}
                </p>
                <h1 className="mt-0.5 text-base leading-snug font-semibold sm:text-lg">
                  {course?.title ?? 'Choose a course'}
                </h1>
              </div>
              <ArrowLeftRight
                size={19}
                className="text-muted-foreground shrink-0"
                aria-hidden="true"
              />
            </Link>
          </LiquidGlass>
        </div>
        {library.error && (
          <p role="alert" className="text-muted-foreground mb-4 text-sm">
            {library.error}
          </p>
        )}
        {course ? (
          <UnitCarousel
            key={course.id}
            course={course}
            busy={busy}
            startButton={startButton}
            teacher={teacher}
          />
        ) : (
          <div className="flex flex-col items-center gap-6 py-8">
            {startButton()}
            {teacher}
          </div>
        )}
      </div>
      <AppBackdrop />
    </div>
  );
};
