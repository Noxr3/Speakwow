'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { useSessionContext } from '@livekit/components-react';
import type { PersonaSummary } from '@speakwow/shared';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { ensureGuestSession } from '@/lib/guest';
import type { HomeLibrary } from '@/lib/study-plan';
import { createClient } from '@/lib/supabase/client';
import type { CallMode } from '@/lib/token-source';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.15,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  startup?: { unitId?: string };
  onStartSession: (unitId?: string) => Promise<void>;
  appConfig: AppConfig;
  personas: PersonaSummary[];
  persona: PersonaSummary;
  onSelectPersona: (id: string) => void;
  library: HomeLibrary;
  mode: CallMode;
}

export function ViewController({
  startup,
  onStartSession,
  appConfig,
  personas,
  persona,
  onSelectPersona,
  library,
  mode,
}: ViewControllerProps) {
  const { isConnected } = useSessionContext();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const wasConnected = useRef(false);
  useEffect(() => {
    const justEnded = wasConnected.current && !isConnected;
    wasConnected.current = isConnected;
    if (!justEnded) return;
    router.refresh();
    // The final reflection finishes after disconnect; refresh its saved result.
    const timers = [3000, 10000, 30000, 45000].map((delay) =>
      window.setTimeout(() => router.refresh(), delay)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [isConnected, router]);

  // A visitor becomes a guest when they start a call, not when the page
  // loads, so the call
  // is kept and can join their account later (lib/guest.ts).
  const startCall = useCallback(
    async (unitId?: string, guestReady = false) => {
      if (busy) return;
      setBusy(true);
      try {
        if (!guestReady) await ensureGuestSession(createClient());
        await onStartSession(unitId);
      } catch {
        toast.error('Could not start the lesson. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, onStartSession]
  );

  const started = useRef(false);
  useEffect(() => {
    if (startup && !started.current) {
      started.current = true;
      void startCall(startup.unitId, true);
    }
  }, [startup, startCall]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* Welcome view */}
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          personas={personas}
          persona={persona}
          onSelectPersona={onSelectPersona}
          library={library}
          busy={busy}
          onStartCall={startCall}
        />
      )}
      {/* Session view */}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          appConfig={appConfig}
          persona={persona}
          mode={library.selectedId ? mode : 'free'}
        />
      )}
    </AnimatePresence>
  );
}
