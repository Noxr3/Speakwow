'use client';

import { useMemo, useRef, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getAgentTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export type SelectableAgent = 'Frank' | 'Lucy';

function loadInitialAgent(): SelectableAgent {
  if (typeof window === 'undefined') return 'Frank';
  const stored = window.localStorage.getItem('selectedAgent');
  return stored === 'Lucy' ? 'Lucy' : 'Frank';
}

export function App({ appConfig }: AppProps) {
  const [selectedAgent, setSelectedAgentState] = useState<SelectableAgent>(loadInitialAgent);
  const selectedAgentRef = useRef<string>(selectedAgent);

  const setSelectedAgent = (agent: SelectableAgent) => {
    selectedAgentRef.current = agent;
    setSelectedAgentState(agent);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('selectedAgent', agent);
    }
  };

  // Token source reads selection from the ref — no need to recreate the source
  // on every selection change.
  const tokenSource = useMemo(() => getAgentTokenSource(selectedAgentRef), []);

  const session = useSession(tokenSource);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
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
