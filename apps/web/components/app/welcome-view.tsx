'use client';

import Link from 'next/link';
import { ArrowLeftRight, Check, ChevronDown } from 'lucide-react';
import type { PersonaSummary } from '@speakwow/shared';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import { AppBackdrop } from '@/components/app/app-backdrop';
import { UnitCarousel } from '@/components/app/unit-carousel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiquidGlass } from '@/components/ui/liquid-glass';
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
    <Magnet padding={10} disabled={busy} magnetStrength={10}>
      <button
        disabled={busy}
        onClick={() => onStartCall(unitId)}
        className="cursor-pointer rounded-full transition-transform duration-300 hover:scale-105 active:scale-95 disabled:cursor-wait"
      >
        <GlassSurface
          className="rounded-full font-mono text-xs uppercase"
          width={220}
          height={48}
          displace={0.5}
          distortionScale={-180}
          redOffset={70}
          greenOffset={10}
          blueOffset={20}
          borderRadius={50}
          backgroundOpacity={0.55}
          mixBlendMode="screen"
          forceDark
          refract={!course}
        >
          {busy
            ? 'One moment…'
            : course
              ? continuing
                ? 'Continue lesson'
                : 'Start lesson'
              : 'Start talking'}
        </GlassSurface>
      </button>
    </Magnet>
  );
  const teacher = (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        className="text-muted-foreground mt-3 inline-flex min-h-11 items-center gap-2 px-2 text-xs"
        aria-label={`Choose a teacher, currently ${persona.display_name}`}
      >
        With {persona.display_name}
        <ChevronDown size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-80 min-w-60 overflow-y-auto">
        {personas.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => onSelectPersona(p.id)}
            className="min-h-11 justify-between"
          >
            <span>{p.display_name}</span>
            {persona.id === p.id && <Check size={15} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div
      ref={ref}
      className="flex min-h-svh flex-col items-center justify-center overflow-x-clip px-5 pt-28 pb-20"
    >
      <div className="w-full max-w-sm space-y-4">
        <section aria-label="Choose a course">
          <LiquidGlass radius={24} tint={0.88}>
            <div className="flex min-h-14 items-center justify-between gap-3 px-5 py-1.5">
              <h1 className="text-sm leading-relaxed font-medium">
                <span className="text-muted-foreground mr-2 font-normal">Course: </span>
                {course?.title ?? 'Choose a course'}
              </h1>
              <Link
                href="/courses"
                aria-label={course ? `Change course, currently ${course.title}` : 'Choose a course'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
              >
                <ArrowLeftRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </LiquidGlass>
        </section>
        {library.error && (
          <p role="alert" className="text-muted-foreground text-center text-xs">
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
          <div className="flex flex-col items-center gap-4 py-6">
            {startButton()}
            {teacher}
          </div>
        )}
      </div>
      <AppBackdrop />
    </div>
  );
};
