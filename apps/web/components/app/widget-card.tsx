'use client';

import { useMemo, useState } from 'react';
import { CheckCircleIcon, MicrophoneIcon, XCircleIcon, XIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/shadcn/utils';
import { type Widget, answerMessage, sameAnswer } from '@/lib/widgets';

interface WidgetCardProps {
  widget: Widget;
  /** sends a chat line to the teacher */
  onAnswer: (message: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<Widget['kind'], string> = {
  word_card: 'New word',
  choice: 'Quick check',
  fill_blank: 'Fill the gap',
  build_sentence: 'Build the sentence',
  say_it: 'Say it out loud',
  goals: "Today's goals",
};

function Option({
  children,
  state,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  state?: 'right' | 'wrong' | 'picked';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        'border-white/15 bg-white/5 hover:bg-white/10 disabled:cursor-default',
        state === 'right' && 'border-emerald-400/70 bg-emerald-400/15',
        state === 'wrong' && 'border-rose-400/70 bg-rose-400/15',
        state === 'picked' && 'border-primary bg-primary/15',
        className
      )}
    >
      {children}
    </button>
  );
}

function Verdict({ correct }: { correct: boolean | null }) {
  if (correct === null)
    return <p className="text-muted-foreground text-xs">Sent to your teacher.</p>;
  return correct ? (
    <p className="flex items-center gap-1 text-sm text-emerald-300">
      <CheckCircleIcon weight="fill" /> Nice! That&apos;s right.
    </p>
  ) : (
    <p className="flex items-center gap-1 text-sm text-rose-300">
      <XCircleIcon weight="fill" /> Not quite — your teacher will help.
    </p>
  );
}

function shuffled(words: string[], seed: string): string[] {
  // Deterministic per card, so a re-render does not reshuffle under the finger.
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const out = [...words];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function WidgetCard({ widget, onAnswer, onClose }: WidgetCardProps) {
  const [result, setResult] = useState<{ given: string; correct: boolean | null } | null>(null);
  const [typed, setTyped] = useState('');
  const [built, setBuilt] = useState<number[]>([]);
  const pool = useMemo(() => shuffled(widget.words ?? [], widget.id), [widget.words, widget.id]);

  const submit = (given: string) => {
    if (result || !given.trim()) return;
    const correct = sameAnswer(given, widget.answer);
    setResult({ given, correct });
    onAnswer(answerMessage(widget, given.trim(), correct));
  };

  const optionState = (option: string): 'right' | 'wrong' | 'picked' | undefined => {
    if (!result) return undefined;
    if (widget.answer && sameAnswer(option, widget.answer)) return 'right';
    if (option === result.given) return result.correct === null ? 'picked' : 'wrong';
    return undefined;
  };

  let body: React.ReactNode;
  switch (widget.kind) {
    case 'word_card':
      body = (
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{widget.word}</p>
          {widget.phonetic && <p className="text-muted-foreground">{widget.phonetic}</p>}
          {widget.meaning && <p>{widget.meaning}</p>}
          {widget.example && <p className="text-muted-foreground italic">“{widget.example}”</p>}
        </div>
      );
      break;
    case 'choice':
      body = (
        <div className="space-y-3">
          <p className="font-medium">{widget.question}</p>
          <div className="grid gap-2">
            {widget.options?.map((option) => (
              <Option
                key={option}
                state={optionState(option)}
                disabled={Boolean(result)}
                onClick={() => submit(option)}
              >
                {option}
              </Option>
            ))}
          </div>
        </div>
      );
      break;
    case 'fill_blank':
      body = (
        <div className="space-y-3">
          <p className="text-lg">
            {widget.sentence?.split('___').map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 && (
                  <span className="border-primary mx-1 inline-block min-w-12 border-b-2 text-center">
                    {result?.given ?? ' '}
                  </span>
                )}
              </span>
            ))}
          </p>
          {widget.options?.length ? (
            <div className="flex flex-wrap gap-2">
              {widget.options.map((option) => (
                <Option
                  key={option}
                  state={optionState(option)}
                  disabled={Boolean(result)}
                  onClick={() => submit(option)}
                >
                  {option}
                </Option>
              ))}
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(typed);
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={Boolean(result)}
                aria-label="Your answer"
                className="border-input bg-background flex-1 rounded-md border px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={Boolean(result)}
                className="bg-primary text-primary-foreground rounded-md px-3 text-sm"
              >
                Check
              </button>
            </form>
          )}
        </div>
      );
      break;
    case 'build_sentence': {
      const sentence = built.map((i) => pool[i]).join(' ');
      body = (
        <div className="space-y-3">
          <p className="min-h-8 rounded-md border border-dashed border-white/20 px-3 py-1.5">
            {sentence || <span className="text-muted-foreground">Tap the words in order…</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {pool.map((word, i) => (
              <Option
                key={`${word}-${i}`}
                disabled={Boolean(result) || built.includes(i)}
                className={built.includes(i) ? 'opacity-30' : undefined}
                onClick={() => setBuilt((b) => [...b, i])}
              >
                {word}
              </Option>
            ))}
          </div>
          {!result && (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-muted-foreground text-sm underline"
                onClick={() => setBuilt([])}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={built.length < pool.length}
                className="bg-primary text-primary-foreground ml-auto rounded-md px-3 py-1 text-sm disabled:opacity-40"
                onClick={() => submit(sentence)}
              >
                Check
              </button>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'say_it':
      body = (
        <div className="space-y-2">
          <p className="text-xl font-medium">{widget.text}</p>
          {widget.tip && <p className="text-muted-foreground text-sm">{widget.tip}</p>}
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <MicrophoneIcon /> Just say it — your teacher is listening.
          </p>
        </div>
      );
      break;
    case 'goals':
      body = (
        <ul className="space-y-1.5">
          {widget.items?.map((item, i) => {
            const done = widget.done?.includes(i);
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircleIcon
                  weight={done ? 'fill' : 'regular'}
                  className={cn(
                    'mt-0.5 shrink-0',
                    done ? 'text-emerald-400' : 'text-muted-foreground'
                  )}
                />
                <span className={cn(done && 'text-muted-foreground line-through')}>{item}</span>
              </li>
            );
          })}
        </ul>
      );
      break;
  }

  return (
    <section
      aria-label={KIND_LABEL[widget.kind]}
      className="bg-background/85 space-y-3 rounded-2xl border border-white/15 p-4 shadow-2xl backdrop-blur-md"
    >
      <header className="flex items-center gap-2">
        <span className="text-primary text-xs font-semibold tracking-wide uppercase">
          {widget.title || KIND_LABEL[widget.kind]}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close card"
          className="text-muted-foreground hover:text-foreground ml-auto"
        >
          <XIcon />
        </button>
      </header>
      {body}
      {result && <Verdict correct={result.correct} />}
    </section>
  );
}
