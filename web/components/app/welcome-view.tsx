import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import { Button } from '@/components/ui/button';
import ColorBends from '../ColorBends';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref}>
      <section className="flex flex-col items-center justify-center text-center gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wow5-logo-white.png" alt="Speakwow" className="h-10 w-auto" />
          <span className="text-foreground text-2xl font-bold tracking-tight">Speakwow</span>
        </div>

        <p className="text-muted-foreground text-sm md:text-base">
          Talk more. Think less.
        </p>

        <Magnet padding={15} disabled={false} magnetStrength={10}>
          <button
            type="button"
            onClick={onStartCall}
            className="bg-background/10 mt-2 cursor-pointer rounded-full transition-transform duration-400 hover:scale-110 hover:font-bold active:scale-95"
          >
            <GlassSurface
              className="w-64 rounded-full font-mono text-xs uppercase"
              displace={0.5}
              width={256}
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
              <span>{startButtonText}</span>
            </GlassSurface>
          </button>
        </Magnet>
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
