'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { PersonaSummary } from '@speakwow/shared';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { loadPersonaId, savePersonaId } from '@/lib/client-prefs';
import { type CallChoice, type CallMode, getAgentTokenSource } from '@/lib/token-source';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

/** Where the signed-in student is in their course, if they have one. */
export interface CourseSpot {
  title: string;
  unitPosition: number;
  unitTitle: string;
}

interface AppProps {
  appConfig: AppConfig;
  personas: PersonaSummary[];
  course: CourseSpot | null;
}

export function App({ appConfig, personas, course }: AppProps) {
  const ids = personas.map((p) => p.id);
  const [personaId, setPersonaIdState] = useState(ids[0]);
  const [mode, setMode] = useState<CallMode>(course ? 'course' : 'free');
  const choiceRef = useRef<CallChoice>({ persona: personaId, mode });
  choiceRef.current = { persona: personaId, mode };

  // Read the remembered teacher after mount so server and client render alike.
  useEffect(() => {
    setPersonaIdState(loadPersonaId(ids, ids[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPersonaId = (id: string) => {
    setPersonaIdState(id);
    savePersonaId(id);
  };

  // The token source reads the ref at call time; no need to recreate it.
  const tokenSource = useMemo(() => getAgentTokenSource(choiceRef), []);
  const session = useSession(tokenSource);
  const persona = personas.find((p) => p.id === personaId) ?? personas[0];

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          personas={personas}
          persona={persona}
          onSelectPersona={setPersonaId}
          course={course}
          mode={mode}
          onSelectMode={setMode}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{ warning: <WarningIcon weight="bold" /> }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
