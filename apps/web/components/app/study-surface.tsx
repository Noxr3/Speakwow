'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MessageCircle, Pause, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { useChat, useDataChannel } from '@livekit/components-react';
import { type StudyMaterial, parseMaterial } from '@/lib/study-material';

export function StudySurface({ courseMode }: { courseMode: boolean }) {
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState('welcome');
  const [sessionTitle, setSessionTitle] = useState('');
  const { send } = useChat();
  const { send: sendAction } = useDataChannel('speakwow.study.action');
  useDataChannel('speakwow.material', (message) => {
    const next = parseMaterial(message.payload);
    if (next) {
      setMaterial(next);
      setDraft('');
      setSubmitted(false);
    }
  });
  useDataChannel('speakwow.study', (message) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(message.payload));
      if (['welcome', 'teaching', 'chat', 'break', 'between', 'complete'].includes(data.phase)) {
        setPhase(data.phase);
        setSessionTitle(String(data.session ?? '').slice(0, 100));
      }
    } catch {
      /* Ignore malformed events. */
    }
  });
  const change = async (action: string) => {
    try {
      await sendAction(new TextEncoder().encode(JSON.stringify({ action })), { reliable: true });
    } catch {
      toast.error('Could not reach your teacher. Please try again.');
    }
  };
  return (
    <>
      {courseMode && (
        <div className="absolute inset-x-4 top-32 z-20 flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {phase === 'break' ? 'Take your time. Your place is kept.' : sessionTitle}
          </p>
          <div className="border-border bg-card flex rounded-full border p-1">
            {phase !== 'teaching' && phase !== 'complete' && (
              <button
                onClick={() => change(phase === 'welcome' ? 'start' : 'resume')}
                className="text-primary inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs"
              >
                <Play size={14} />
                {phase === 'welcome' ? 'Begin lesson' : 'Continue lesson'}
              </button>
            )}
            {phase === 'teaching' && (
              <button
                onClick={() => change('pause')}
                className="text-muted-foreground inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs"
              >
                <Pause size={14} />
                Take a break
              </button>
            )}
            {phase !== 'chat' && (
              <button
                onClick={() => change('chat')}
                className="text-muted-foreground inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs"
              >
                <MessageCircle size={14} />
                Just chat
              </button>
            )}
          </div>
        </div>
      )}
      {material && (
        <section
          aria-label="Lesson material"
          className="border-border bg-card fixed inset-x-4 top-52 bottom-40 z-30 mx-auto flex max-w-xl flex-col overflow-auto rounded-3xl border p-5 shadow-2xl sm:top-48 sm:bottom-44 sm:p-7"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="pt-2 text-lg font-medium">{material.title}</h2>
            <button
              aria-label="Close material"
              onClick={() => setMaterial(null)}
              className="text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>
          {material.kind === 'picture' && (
            <Image
              width={640}
              height={360}
              src={`/scenes/${material.scene}.svg`}
              alt={`Illustrated ${material.scene} scene for discussion`}
              className="mb-4 w-full rounded-2xl"
            />
          )}
          {material.text && (
            <p className="mb-5 text-base leading-relaxed whitespace-pre-wrap">{material.text}</p>
          )}
          {material.prompt && (
            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{material.prompt}</p>
          )}
          {['writing', 'dictation'].includes(material.kind) && (
            <form
              className="flex flex-1 flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.trim() || sending) return;
                setSending(true);
                try {
                  await send(draft.trim());
                  setSubmitted(true);
                } catch {
                  toast.error('Your writing was not sent. Please try again.');
                } finally {
                  setSending(false);
                }
              }}
            >
              <label htmlFor="study-writing" className="sr-only">
                Your writing
              </label>
              <textarea
                id="study-writing"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSubmitted(false);
                }}
                maxLength={4000}
                rows={5}
                placeholder={
                  material.kind === 'dictation' ? 'Write what you hear…' : 'Start writing…'
                }
                className="field min-h-32 flex-1 resize-y leading-relaxed"
              />
              <button
                disabled={!draft.trim() || sending || submitted}
                className="bg-primary text-primary-foreground min-h-11 self-end rounded-full px-5 text-sm font-medium disabled:opacity-50"
              >
                {submitted ? 'Sent to your teacher' : sending ? 'Sending…' : 'Share writing'}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
