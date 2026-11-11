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
import { savePersonaId } from '@/lib/client-prefs';
import type { HomeLibrary } from '@/lib/study-plan';
import { type CallChoice, type CallMode, getAgentTokenSource } from '@/lib/token-source';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface CallAppProps {
  initialPersonaId: string;
  startup: { unitId?: string };
  appConfig: AppConfig;
  personas: PersonaSummary[];
  library: HomeLibrary;
}

export function CallApp({ appConfig, personas, library, initialPersonaId, startup }: CallAppProps) {
  const [personaId, setPersonaIdState] = useState(initialPersonaId);
  const [courseId, setCourseId] = useState(library.selectedId);
  useEffect(() => {
    setCourseId(library.selectedId);
  }, [library.selectedId]);
  const mode: CallMode = courseId ? 'course' : 'free';
  const unitRef = useRef(startup.unitId);
  const choiceRef = useRef<CallChoice>({ persona: personaId, mode });
  choiceRef.current = { persona: personaId, mode, course_id: courseId, unit_id: unitRef.current };

  const setPersonaId = (id: string) => {
    setPersonaIdState(id);
    savePersonaId(id);
  };

  // The token source reads the ref at call time; no need to recreate it.
  const tokenSource = useMemo(() => getAgentTokenSource(choiceRef), []);
  const session = useSession(tokenSource);
  const persona = personas.find((p) => p.id === personaId) ?? personas[0];

  // useSession never hangs up by itself: leaving this page mid-call (the
  // header's Settings or Sign in) kept the call and the microphone running,
  // with no screen left to end it from.
  const endCall = useRef(session.end);
  endCall.current = session.end;
  useEffect(() => () => void endCall.current(), []);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <div className="min-h-svh">
        <ViewController
          startup={startup}
          onStartSession={async (unitId) => {
            unitRef.current = unitId;
            choiceRef.current.unit_id = unitId;
            await session.start();
          }}
          appConfig={appConfig}
          personas={personas}
          persona={persona}
          onSelectPersona={setPersonaId}
          library={library}
          mode={mode}
        />
      </div>
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
