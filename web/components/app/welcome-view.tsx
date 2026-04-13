import { Button } from '@/components/ui/button';
import GlassSurface from '@/components/GlassSurface'
import Magnet from '@/components/Magnet'
import ColorBends from '../ColorBends';


function WelcomeImage() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wow5-logo-white.png"
      alt="WOW5 Logo"
      className="mb-4 h-16 w-auto"
    />
  );
}

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
      <section className="flex flex-col items-center justify-center text-center">
        <WelcomeImage />

        <p className="text-foreground max-w-prose pt-1 leading-6 font-medium">
          Chat live with your voice AI agent
        </p>
        <Magnet padding={15} disabled={false} magnetStrength={10}>


        <button
          type="button"
          onClick={onStartCall}
          className="mt-6 cursor-pointer transition-transform duration-400 hover:scale-110 active:scale-95 hover:font-bold bg-background/10 rounded-full"
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

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center">
        <p className="text-muted-foreground max-w-prose pt-1 text-xs leading-5 font-normal text-pretty md:text-sm">
          Need help getting set up? Check out the{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.livekit.io/agents/start/voice-ai/"
            className="underline"
          >
            Voice AI quickstart
          </a>
          .
        </p>
      </div>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}>
        <ColorBends
          colors={["#00ff1e","#2c7be2","#501b35"]}
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
