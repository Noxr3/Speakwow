'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, X } from 'lucide-react';
import { useAgent, useRoomContext } from '@livekit/components-react';
import * as Popover from '@radix-ui/react-popover';
import { SpeechControls } from '@/components/settings/speech-controls';
import { saveSpeechPreferences } from '@/lib/client-prefs';
import {
  DEFAULT_SPEECH,
  SPEECH_ATTRIBUTE,
  SPEECH_RPC,
  type SpeechPreferences,
  type SpeechState,
  newerSpeechState,
  parseSpeechState,
  speedLabel,
} from '@/lib/speech-speed';

export function SpeechSpeedMenu() {
  const room = useRoomContext();
  const agent = useAgent();
  const [state, setState] = useState<SpeechState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const identity = agent.identity;
  const latestIdentity = useRef(identity);
  latestIdentity.current = identity;
  const raw = agent.attributes[SPEECH_ATTRIBUTE];

  useEffect(() => {
    setState(null);
    setError('');
    setBusy(false);
  }, [identity]);
  useEffect(() => {
    const next = parseSpeechState(raw);
    if (next) setState((current) => newerSpeechState(current, next));
  }, [raw, identity]);
  // Teacher choices are visible during this call; only explicit student choices
  // become the next call's preference. Never persist an unconfirmed speed.
  useEffect(() => {
    if (state?.supported && !state.pending && !state.error && state.source === 'student') {
      saveSpeechPreferences({ speed: state.speed, adaptive: state.adaptive });
    }
  }, [state]);

  const change = async (next: SpeechPreferences) => {
    if (!identity || busy || !state?.supported) return;
    setBusy(true);
    setError('');
    try {
      const result = await room.localParticipant.performRpc({
        destinationIdentity: identity,
        method: SPEECH_RPC,
        payload: JSON.stringify(next),
        responseTimeout: 5,
      });
      if (latestIdentity.current !== identity) return;
      const parsed = parseSpeechState(result);
      if (!parsed) throw new Error('Invalid response');
      setState((current) => newerSpeechState(current, parsed));
    } catch {
      if (latestIdentity.current === identity) setError('Could not reach your teacher. Try again.');
    } finally {
      if (latestIdentity.current === identity) setBusy(false);
    }
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Speech speed${state ? `, ${speedLabel(state.appliedSpeed ?? state.speed)}` : ''}`}
          className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-primary pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm focus-visible:ring-2"
        >
          <Gauge size={16} aria-hidden="true" />
          <span className="tabular-nums">
            {state ? speedLabel(state.appliedSpeed ?? state.speed) : 'Speed'}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="end"
          collisionPadding={16}
          className="border-border bg-popover text-popover-foreground z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-3xl border p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Teacher’s voice</h2>
            <Popover.Close
              aria-label="Close voice settings"
              className="text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-full"
            >
              <X size={18} />
            </Popover.Close>
          </div>
          <SpeechControls
            value={state ?? DEFAULT_SPEECH}
            onChange={change}
            disabled={!state?.supported || busy}
          />
          <p role="status" className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {error ||
              state?.error ||
              (!state
                ? 'Waiting for your teacher…'
                : !state.supported
                  ? 'Speed adjustment is available with OpenAI voice.'
                  : busy
                    ? 'Sending…'
                    : state.pending
                      ? 'Changing for the next reply…'
                      : state.source === 'teacher'
                        ? 'Adjusted by your teacher.'
                        : 'Ready for your next reply.')}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
