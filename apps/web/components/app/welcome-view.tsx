'use client';

import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
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
      <DropdownMenuContent
        align="center"
        className="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        {personas.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => onSelectPersona(p.id)}
            className="min-h-11 items-start gap-3 px-3 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{p.display_name}</span>
              <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                {p.tagline_en}
              </span>
            </span>
            {persona.id === p.id && (
              <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
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
        <h1 className="px-6 text-center text-sm leading-relaxed text-white/70">
          {course?.title ?? (
            <Link href="/courses" className="hover:text-white">
              Choose a course
            </Link>
          )}
        </h1>
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
