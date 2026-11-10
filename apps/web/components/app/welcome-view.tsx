'use client';

import Link from 'next/link';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { PersonaSummary } from '@speakwow/shared';
import ColorBends from '@/components/ColorBends';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { type HomeLibrary, coursePosition } from '@/lib/study-plan';
import type { CallMode } from '@/lib/token-source';

interface WelcomeViewProps {
  personas: PersonaSummary[];
  persona: PersonaSummary;
  onSelectPersona: (id: string) => void;
  library: HomeLibrary;
  busy: boolean;
  mode: CallMode;
  onSelectMode: (mode: CallMode) => void;
  onStartCall: () => void;
}

export const WelcomeView = ({
  personas,
  persona,
  onSelectPersona,
  library,
  busy,
  mode,
  onSelectMode,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const course = library.courses.find((c) => c.id === library.selectedId);
  const position = course ? coursePosition(course) : null;
  return (
    <div ref={ref} className="flex min-h-svh flex-col items-center justify-center px-5 pt-28 pb-20">
      <section aria-label="Your next lesson" className="w-full max-w-sm">
        <LiquidGlass radius={28} tint={0.88} refract={false}>
          <div className="flex flex-col items-center px-6 py-8 text-center sm:px-8">
            <Link
              href="/courses"
              aria-label={course ? `Change course, currently ${course.title}` : 'Choose a course'}
              className="group flex min-h-11 w-full items-center justify-between gap-4 text-left"
            >
              <h1 className="text-lg leading-relaxed font-medium">
                {course?.title ?? 'Choose a course'}
              </h1>
              <ChevronRight
                size={18}
                className="text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1"
              />
            </Link>
            {position?.unit && (
              <p className="text-muted-foreground mt-2 w-full text-left text-xs leading-relaxed">
                Lesson {position.unit.position} · {position.unit.title}
              </p>
            )}
            {library.error && (
              <p role="alert" className="text-muted-foreground mt-2 text-xs">
                {library.error}
              </p>
            )}
            <div className="mt-8">
              <Magnet padding={10} disabled={busy} magnetStrength={10}>
                <button
                  disabled={busy}
                  onClick={onStartCall}
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
                    brightness={50}
                    opacity={0.63}
                    backgroundOpacity={0.55}
                    mixBlendMode="screen"
                    forceDark
                  >
                    {busy
                      ? 'One moment…'
                      : mode === 'course' && course
                        ? 'Continue lesson'
                        : 'Start talking'}
                  </GlassSurface>
                </button>
              </Magnet>
            </div>
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
            {course && (
              <button
                disabled={busy}
                onClick={() => onSelectMode(mode === 'course' ? 'free' : 'course')}
                className="text-muted-foreground hover:text-foreground min-h-11 px-3 text-xs"
              >
                {mode === 'course' ? 'Just talk instead' : 'Back to my lesson'}
              </button>
            )}
          </div>
        </LiquidGlass>
      </section>
      <p className="mt-6 text-center font-mono text-[11px] text-white/50">
        {persona.display_name} is an AI teacher.
      </p>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <ColorBends
          colors={['#00ff1e', '#2c7be2', '#501b35']}
          rotation={0}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={0.95}
          mouseInfluence={1}
          parallax={0.5}
          noise={0.1}
          transparent
          autoRotate={0}
        />
      </div>
    </div>
  );
};
