'use client';

import { useEffect, useState } from 'react';
import { SpeechControls } from '@/components/settings/speech-controls';
import { loadSpeechPreferences, saveSpeechPreferences } from '@/lib/client-prefs';
import { DEFAULT_SPEECH } from '@/lib/speech-speed';

export function SpeechForm() {
  const [value, setValue] = useState(DEFAULT_SPEECH);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(loadSpeechPreferences());
    setReady(true);
  }, []);
  return (
    <section
      aria-labelledby="speech-heading"
      className="border-border bg-card rounded-3xl border p-6"
    >
      <h2 id="speech-heading" className="text-lg font-semibold">
        Teacher’s voice
      </h2>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Your starting pace for new calls. Remembered in this browser.
      </p>
      <SpeechControls
        value={value}
        disabled={!ready}
        onChange={(next) => {
          setValue(next);
          saveSpeechPreferences(next);
        }}
      />
    </section>
  );
}
