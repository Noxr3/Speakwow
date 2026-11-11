'use client';

import { useEffect, useState } from 'react';
import type { PersonaSummary } from '@speakwow/shared';
import type { AppConfig } from '@/app-config';
import { WelcomeView } from '@/components/app/welcome-view';
import { loadPersonaId, savePersonaId } from '@/lib/client-prefs';
import type { HomeLibrary } from '@/lib/study-plan';

type Runtime = typeof import('./call-app');
let runtime: Promise<Runtime> | undefined;
function loadRuntime() {
  return (runtime ??= import('./call-app').catch((error) => {
    runtime = undefined;
    throw error;
  }));
}

/** Browsing lessons should not download or initialize the RTC/classroom stack. */
export function App({
  appConfig,
  personas,
  library,
}: {
  appConfig: AppConfig;
  personas: PersonaSummary[];
  library: HomeLibrary;
}) {
  const [personaId, setPersonaId] = useState(personas[0].id);
  const [call, setCall] = useState<{
    Component: Runtime['CallApp'];
    startup: { unitId?: string };
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setPersonaId(
      loadPersonaId(
        personas.map((p) => p.id),
        personas[0].id
      )
    );
  }, [personas]);
  const persona = personas.find((p) => p.id === personaId) ?? personas[0];
  if (call)
    return (
      <call.Component
        appConfig={appConfig}
        personas={personas}
        library={library}
        initialPersonaId={personaId}
        startup={call.startup}
      />
    );
  return (
    <>
      <WelcomeView
        personas={personas}
        persona={persona}
        library={library}
        busy={busy}
        onSelectPersona={(id) => {
          setPersonaId(id);
          savePersonaId(id);
        }}
        onPrepareCall={() => {
          void loadRuntime().catch(() => undefined);
        }}
        onStartCall={async (unitId) => {
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            const [{ CallApp }] = await Promise.all([
              loadRuntime(),
              Promise.all([import('@/lib/guest'), import('@/lib/supabase/client')]).then(
                ([{ ensureGuestSession }, { createClient }]) => ensureGuestSession(createClient())
              ),
            ]);
            setCall({ Component: CallApp, startup: { unitId } });
          } catch {
            setError('Could not start the lesson. Please try again.');
            setBusy(false);
          }
        }}
      />
      {error && (
        <p
          role="alert"
          className="bg-popover text-destructive fixed inset-x-6 bottom-6 mx-auto max-w-xl rounded-2xl border p-4 text-sm"
        >
          {error}
        </p>
      )}
    </>
  );
}
