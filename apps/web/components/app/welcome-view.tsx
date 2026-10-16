import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr';
import type { PersonaSummary } from '@speakwow/shared';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import type { CourseSpot } from '@/components/app/app';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * The first screen, kept as plain as the very first Speakwow: the name, one
 * line, and one button. The caret beside it switches teacher.
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
      <section className="flex flex-col items-center justify-center gap-6 text-center">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wow5-logo-white.png" alt="" className="h-10 w-auto" />
          <span className="text-foreground font-mono text-2xl font-bold tracking-tight">
            Speakwow
          </span>
        </div>

        <p className="text-foreground text-sm md:text-base">A teacher who remembers you.</p>

        <div className="mt-2 flex items-stretch">
          <Magnet padding={10} disabled={false} magnetStrength={10}>
            <button
              type="button"
              onClick={onStartCall}
              className="cursor-pointer rounded-full transition-transform duration-400 hover:scale-105 active:scale-95"
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
                forceDark
              >
                <span>Talk with {persona.display_name}</span>
              </GlassSurface>
            </button>
          </Magnet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Choose a teacher"
                className="ml-2 flex h-12 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition-transform duration-300 hover:scale-105 active:scale-95"
              >
                <CaretDownIcon size={16} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              collisionPadding={12}
              className="max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-60 overflow-y-auto"
            >
              {personas.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => onSelectPersona(p.id)}
                  className={persona.id === p.id ? 'bg-accent' : ''}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{p.display_name}</span>
                    {p.specialty_en && (
                      <span className="text-muted-foreground text-xs">{p.specialty_en}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {course && (
          <div className="flex gap-4 font-mono text-xs" role="group" aria-label="What to do">
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
                  'cursor-pointer underline-offset-4 transition-colors',
                  mode === value ? 'text-foreground underline' : 'text-white/50 hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* The teacher talks as themselves and never brings up being an AI,
            so the page says it before every call. */}
        <p className="font-mono text-xs text-white/40">{persona.display_name} is an AI teacher.</p>
      </section>

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
