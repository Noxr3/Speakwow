import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr';
import type { SelectableAgent } from '@/components/app/app';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ColorBends from '../ColorBends';

interface WelcomeViewProps {
  selectedAgent: SelectableAgent;
  onSelectAgent: (agent: SelectableAgent) => void;
  onStartCall: () => void;
}

const AGENT_DESCRIPTIONS: Record<SelectableAgent, string> = {
  Frank: 'English conversation partner',
  Lucy: 'Connects you to OpenAgora agents',
};

export const WelcomeView = ({
  selectedAgent,
  onSelectAgent,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref}>
      <section className="flex flex-col items-center justify-center gap-6 text-center">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wow5-logo-white.png" alt="Speakwow" className="h-10 w-auto" />
          <span className="text-foreground font-mono text-2xl font-bold tracking-tight">
            Speakwow
          </span>
        </div>

        <p className="text-foreground text-sm md:text-base">Your Personal Language Tutor</p>

        <div className="mt-2 flex items-stretch overflow-hidden rounded-full">
          {/* Main "Talk to {agent}" button */}
          <Magnet padding={10} disabled={false} magnetStrength={10}>
            <button
              type="button"
              onClick={onStartCall}
              className="bg-background/10 cursor-pointer rounded-full transition-transform duration-400 hover:scale-105 active:scale-95"
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
                <span>Talk to {selectedAgent}</span>
              </GlassSurface>
            </button>
          </Magnet>

          {/* Dropdown caret to switch agents */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Switch agent"
                className="bg-background/10 ml-2 flex h-12 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition-transform duration-300 hover:scale-105 active:scale-95"
              >
                <CaretDownIcon size={16} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {(Object.keys(AGENT_DESCRIPTIONS) as SelectableAgent[]).map((agent) => (
                <DropdownMenuItem
                  key={agent}
                  onSelect={() => onSelectAgent(agent)}
                  className={selectedAgent === agent ? 'bg-accent' : ''}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{agent}</span>
                    <span className="text-muted-foreground text-xs">
                      {AGENT_DESCRIPTIONS[agent]}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
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
