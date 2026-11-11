'use client';

import { useEffect, useId, useState } from 'react';
import { type SpeechPreferences, speedLabel } from '@/lib/speech-speed';

/** Shared by Settings and the classroom; a drag commits only on release. */
export function SpeechControls({
  value,
  onChange,
  disabled = false,
}: {
  value: SpeechPreferences;
  onChange: (value: SpeechPreferences) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value.speed);
  useEffect(() => setDraft(value.speed), [value.speed]);
  const commit = () => {
    if (draft !== value.speed) onChange({ ...value, speed: draft });
  };
  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-50">
      <div>
        <div className="mb-1 flex items-center justify-between gap-4">
          <label htmlFor={id} className="text-sm font-medium">
            Speech speed
          </label>
          <output htmlFor={id} className="text-primary text-sm font-medium tabular-nums">
            {speedLabel(draft)}
          </output>
        </div>
        <input
          id={id}
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={draft}
          aria-valuetext={speedLabel(draft)}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="accent-primary h-11 w-full cursor-pointer disabled:cursor-default"
        />
        <div className="text-muted-foreground -mt-2 flex justify-between text-xs">
          <span>Slower · 0.5×</span>
          <span>Faster · 1.5×</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0.75, 1, 1.25].map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={value.speed === speed}
            onClick={() => onChange({ ...value, speed })}
            className="border-border hover:bg-accent aria-pressed:border-primary/50 aria-pressed:bg-primary/10 aria-pressed:text-primary min-h-11 rounded-xl border text-sm transition-colors"
          >
            {speedLabel(speed)}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
        <span>Let your teacher adjust</span>
        <input
          type="checkbox"
          checked={value.adaptive}
          className="accent-primary size-5 shrink-0"
          onChange={(event) => onChange({ ...value, adaptive: event.target.checked })}
        />
      </label>
      <p className="text-muted-foreground text-xs leading-relaxed">
        You can always ask “slower” or “faster”. Changes apply to the next reply.
      </p>
    </fieldset>
  );
}
