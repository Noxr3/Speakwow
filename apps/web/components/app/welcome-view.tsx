import Link from 'next/link';
import type { PersonaSummary } from '@speakwow/shared';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import type { CourseSpot } from '@/components/app/app';
import { TeacherCarousel } from '@/components/app/teacher-carousel';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/shadcn/utils';
import type { CallMode } from '@/lib/token-source';
import ColorBends from '../ColorBends';

interface WelcomeViewProps {
  personas: PersonaSummary[];
  persona: PersonaSummary;
  onSelectPersona: (id: string) => void;
  course: CourseSpot | null;
  mode: CallMode;
  onSelectMode: (mode: CallMode) => void;
  onStartCall: () => void;
}

/**
 * One job: pick a teacher and start talking. The ring is the hero; below it,
 * one line about the teacher and one button.
 */
export const WelcomeView = ({
  personas,
  persona,
  onSelectPersona,
  course,
  mode,
  onSelectMode,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const { enabled: accounts, user, loading } = useAuth();

  return (
    <div ref={ref}>
      <section className="flex flex-col items-center gap-3 px-4 pt-10 text-center">
        <h1 className="text-foreground text-lg font-medium text-balance md:text-xl">
          A teacher who remembers you.
        </h1>

        <TeacherCarousel personas={personas} onSelect={onSelectPersona} />

        <p className="text-muted-foreground min-h-10 max-w-sm text-sm" aria-live="polite">
          {persona.tagline_en}
        </p>

        {course && (
          <div
            className="flex rounded-full border border-white/10 p-0.5 text-xs"
            role="group"
            aria-label="What to do"
          >
            {(
              [
                ['course', `Lesson · Unit ${course.unitPosition}`],
                ['free', 'Free talk'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onSelectMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  'rounded-full px-4 py-1.5 transition-colors',
                  mode === value ? 'text-foreground bg-white/15' : 'text-muted-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <Magnet padding={10} disabled={false} magnetStrength={10}>
          <button
            type="button"
            onClick={onStartCall}
            className="bg-background/10 mt-1 cursor-pointer rounded-full transition-transform duration-400 hover:scale-105 active:scale-95"
          >
            <GlassSurface
              className="w-60 rounded-full font-mono text-xs uppercase"
              displace={0.5}
              width={240}
              height={48}
              distortionScale={-180}
              redOffset={70}
              borderRadius={50}
              greenOffset={10}
              blueOffset={20}
              brightness={50}
              opacity={0.63}
              mixBlendMode="screen"
            >
              <span>Talk to {persona.display_name}</span>
            </GlassSurface>
          </button>
        </Magnet>

        {accounts && !loading && !user && (
          <p className="text-muted-foreground text-xs">
            <Link href="/login" className="hover:text-foreground underline">
              Sign in
            </Link>{' '}
            and {persona.display_name} will remember you next time
          </p>
        )}
      </section>

      {/* Dimmed so the teachers are the brightest thing on the page. */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40">
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
