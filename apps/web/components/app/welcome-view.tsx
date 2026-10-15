import type { PersonaSummary } from '@speakwow/shared';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import type { CourseSpot } from '@/components/app/app';
import { TeacherCarousel } from '@/components/app/teacher-carousel';
import { LiquidGlass } from '@/components/ui/liquid-glass';
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
  return (
    <div ref={ref}>
      <section className="flex flex-col items-center gap-5 px-4 pt-14 text-center md:gap-6">
        <h1 className="text-sm font-normal tracking-wide text-white/75 md:text-base">
          A teacher who remembers you.
        </h1>

        <TeacherCarousel personas={personas} onSelect={onSelectPersona} />

        <p className="label-mono text-white/50" aria-live="polite">
          {persona.specialty_en}
        </p>

        {course && (
          <LiquidGlass radius={999} width="auto">
            <div className="flex p-1 text-xs" role="group" aria-label="What to do">
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
                    'rounded-full px-4 py-1.5 font-medium transition-colors',
                    mode === value
                      ? 'text-foreground bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </LiquidGlass>
        )}

        <Magnet padding={10} disabled={false} magnetStrength={10}>
          <button
            type="button"
            onClick={onStartCall}
            className="cursor-pointer rounded-full transition-transform duration-400 hover:scale-105 active:scale-95"
          >
            <GlassSurface
              className="w-64 rounded-full font-mono text-xs tracking-[0.14em] uppercase"
              displace={0.5}
              width={256}
              height={52}
              distortionScale={-180}
              redOffset={70}
              borderRadius={50}
              greenOffset={10}
              blueOffset={20}
              brightness={50}
              opacity={0.63}
              mixBlendMode="screen"
              forceDark
            >
              <span>Talk with {persona.display_name}</span>
            </GlassSurface>
          </button>
        </Magnet>
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
