'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  LightbulbIcon,
  MicrophoneIcon,
  XCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { cn } from '@/lib/shadcn/utils';
import {
  type CardAction,
  type CardUpdate,
  LETTERS,
  type Widget,
  gradeCard,
  namedOptions,
  rightAnswer,
} from '@/lib/widgets';

interface WidgetCardProps {
  widget: Widget;
  /** a spoken answer the teacher marked on this card (mark_card) */
  update?: CardUpdate | null;
  /** what the student did, for the teacher (never a chat line) */
  onEvent: (action: CardAction) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<Widget['kind'], string> = {
  word_card: 'New word',
  choice: 'Quick check',
  true_false: 'True or false',
  fill_blank: 'Fill the gap',
  reorder: 'Put it in order',
  match_pairs: 'Match the pairs',
  quiz: 'Quiz',
  say_it: 'Say it out loud',
  goals: "Today's goals",
};

type Mark = 'right' | 'wrong' | 'picked' | undefined;

function Tile({
  children,
  mark,
  letter,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  mark?: Mark;
  letter?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={mark === 'picked' ? true : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
        'border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-white/10 disabled:cursor-default',
        mark === 'right' && 'border-emerald-400/70 bg-emerald-400/15',
        mark === 'wrong' && 'border-rose-400/60 bg-rose-400/10 text-white/50',
        mark === 'picked' && 'border-primary bg-primary/15',
        className
      )}
    >
      {letter && (
        <span className="label-mono flex size-6 shrink-0 items-center justify-center rounded-md border border-white/20 text-white/70">
          {letter}
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {mark === 'right' && <CheckCircleIcon weight="fill" className="shrink-0 text-emerald-300" />}
      {mark === 'wrong' && (
        <XCircleIcon weight="fill" aria-label="not this one" className="shrink-0 text-rose-300" />
      )}
    </button>
  );
}

function shuffled<T>(items: T[], seed: string): T[] {
  // Deterministic per card, so a re-render does not reshuffle under the finger.
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One closed question (choice, true/false, fill the gap, reorder) with tries and a hint. */
function useTries(
  widget: Widget,
  update: CardUpdate | null | undefined,
  onEvent: WidgetCardProps['onEvent']
) {
  const [tries, setTries] = useState<string[]>([]);
  const [correct, setCorrect] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const finished = correct || revealed;

  const settle = (given: string, verdict: boolean, attempt: number, final: boolean) => {
    setTries((t) => [...t, given].slice(0, attempt));
    if (verdict) setCorrect(true);
    else if (final) setRevealed(true);
  };

  const answer = (given: string) => {
    if (finished || !given.trim()) return;
    const verdict = gradeCard(widget, given) === true;
    const attempt = tries.length + 1;
    settle(given, verdict, attempt, verdict || attempt >= widget.maxAttempts);
    onEvent({ action: 'answer', given });
  };

  // A spoken answer the teacher marked: same outcome, no event back.
  useEffect(() => {
    if (update && update.cardId === widget.id && !finished) {
      settle(update.given, update.correct, update.attempt, update.final);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  return {
    tries,
    correct,
    revealed,
    finished,
    hint,
    answer,
    showHint: () => {
      setHint(true);
      onEvent({ action: 'hint' });
    },
    reveal: () => {
      setRevealed(true);
      onEvent({ action: 'reveal' });
    },
  };
}

function Feedback({ widget, state }: { widget: Widget; state: ReturnType<typeof useTries> }) {
  const { tries, correct, revealed, finished, hint } = state;
  return (
    <div className="space-y-2">
      {hint && widget.hint && !finished && (
        <p className="flex items-start gap-1.5 text-sm text-amber-200/90">
          <LightbulbIcon weight="fill" className="mt-0.5 shrink-0" /> {widget.hint}
        </p>
      )}
      {correct && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircleIcon weight="fill" />{' '}
          {tries.length > 1 ? 'Got it on the second try!' : 'Nice! That’s right.'}
        </p>
      )}
      {!finished && tries.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-rose-300">
          <XCircleIcon weight="fill" /> Not quite. Have another go.
        </p>
      )}
      {revealed && (
        <p className="text-sm">
          <span className="text-muted-foreground">The answer: </span>
          <span className="font-medium text-emerald-300">{rightAnswer(widget)}</span>
        </p>
      )}
      {finished && widget.explain && (
        <p className="text-muted-foreground text-sm leading-relaxed">{widget.explain}</p>
      )}
      {!finished && (widget.hint || tries.length > 0) && (
        <div className="flex gap-4 text-sm">
          {widget.hint && !hint && (
            <button
              type="button"
              onClick={state.showHint}
              className="text-amber-200/90 underline-offset-4 hover:underline"
            >
              Hint
            </button>
          )}
          {tries.length > 0 && (
            <button
              type="button"
              onClick={state.reveal}
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Show answer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceBody({ widget, state }: { widget: Widget; state: ReturnType<typeof useTries> }) {
  const [selected, setSelected] = useState<number[]>([]);
  const options = widget.options ?? [];
  const right = new Set(Array.isArray(widget.answer) ? widget.answer : []);
  const wrongPicks = new Set(
    state.tries.flatMap((t) => (gradeCard(widget, t) ? [] : namedOptions(widget, t)))
  );
  const mark = (i: number): Mark => {
    if (state.finished && right.has(i)) return 'right';
    if (!widget.multi && wrongPicks.has(i)) return 'wrong';
    if (widget.multi && selected.includes(i) && !state.finished) return 'picked';
    return undefined;
  };
  return (
    <div className="space-y-3">
      <p className="font-medium">{widget.question}</p>
      {widget.multi && !state.finished && (
        <p className="text-muted-foreground text-xs">Choose all that apply.</p>
      )}
      <div className="grid gap-2">
        {options.map((option, i) => (
          <Tile
            key={i}
            letter={LETTERS[i]}
            mark={mark(i)}
            disabled={state.finished || (!widget.multi && wrongPicks.has(i))}
            onClick={() =>
              widget.multi
                ? setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
                : state.answer(option)
            }
          >
            {option}
          </Tile>
        ))}
      </div>
      {widget.multi && !state.finished && (
        <button
          type="button"
          disabled={!selected.length}
          onClick={() => {
            state.answer(selected.map((i) => options[i]).join(', '));
            setSelected([]);
          }}
          className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-sm disabled:opacity-40"
        >
          Check
        </button>
      )}
    </div>
  );
}

function TrueFalseBody({ widget, state }: { widget: Widget; state: ReturnType<typeof useTries> }) {
  const picked = state.tries[0];
  return (
    <div className="space-y-3">
      <p className="text-lg">{widget.statement}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['true', 'false'] as const).map((value) => {
          const isRight = (value === 'true') === widget.answer;
          const mark: Mark = state.finished
            ? isRight
              ? 'right'
              : picked === value
                ? 'wrong'
                : undefined
            : undefined;
          return (
            <Tile
              key={value}
              mark={mark}
              disabled={state.finished}
              onClick={() => state.answer(value)}
              className="justify-center"
            >
              {value === 'true' ? 'True' : 'False'}
            </Tile>
          );
        })}
      </div>
    </div>
  );
}

function FillBlankBody({ widget, state }: { widget: Widget; state: ReturnType<typeof useTries> }) {
  const [typed, setTyped] = useState('');
  const shown = state.correct ? state.tries.at(-1) : state.revealed ? rightAnswer(widget) : '';
  const wrong = new Set(
    state.tries.filter((t) => !gradeCard(widget, t)).map((t) => t.trim().toLowerCase())
  );
  return (
    <div className="space-y-3">
      <p className="text-lg leading-relaxed">
        {widget.sentence?.split('___').map((part, i, all) => (
          <span key={i}>
            {part}
            {i < all.length - 1 && (
              <span
                className={cn(
                  'mx-1 inline-block min-w-14 border-b-2 text-center',
                  state.finished ? 'border-emerald-400 text-emerald-300' : 'border-primary'
                )}
              >
                {shown || ' '}
              </span>
            )}
          </span>
        ))}
      </p>
      {widget.options?.length ? (
        <div className="flex flex-wrap gap-2">
          {widget.options.map((option, i) => (
            <Tile
              key={i}
              mark={
                state.finished && gradeCard(widget, option)
                  ? 'right'
                  : wrong.has(option.trim().toLowerCase())
                    ? 'wrong'
                    : undefined
              }
              disabled={state.finished || wrong.has(option.trim().toLowerCase())}
              onClick={() => state.answer(option)}
            >
              {option}
            </Tile>
          ))}
        </div>
      ) : (
        !state.finished && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              state.answer(typed);
              setTyped('');
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Your answer"
              autoComplete="off"
              className="border-input bg-background min-h-11 flex-1 rounded-xl border px-3 text-base"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-xl px-4 text-sm"
            >
              Check
            </button>
          </form>
        )
      )}
    </div>
  );
}

function ReorderBody({ widget, state }: { widget: Widget; state: ReturnType<typeof useTries> }) {
  const pool = useMemo(() => shuffled(widget.words ?? [], widget.id), [widget.words, widget.id]);
  const [built, setBuilt] = useState<number[]>([]);
  const sentence = state.finished
    ? state.correct
      ? state.tries.at(-1)
      : rightAnswer(widget)
    : built.map((i) => pool[i]).join(' ');
  return (
    <div className="space-y-3">
      <p
        className={cn(
          'min-h-11 rounded-xl border border-dashed px-3 py-2',
          state.finished ? 'border-emerald-400/60 text-emerald-200' : 'border-white/20'
        )}
      >
        {sentence || <span className="text-muted-foreground">Tap the words in order…</span>}
      </p>
      {!state.finished && (
        <>
          <div className="flex flex-wrap gap-2">
            {pool.map((word, i) => (
              <Tile
                key={`${word}-${i}`}
                disabled={built.includes(i)}
                className={built.includes(i) ? 'opacity-30' : undefined}
                onClick={() => setBuilt((b) => [...b, i])}
              >
                {word}
              </Tile>
            ))}
          </div>
          <div className="flex gap-3">
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
              className="bg-primary text-primary-foreground ml-auto rounded-full px-4 py-1.5 text-sm disabled:opacity-40"
              onClick={() => {
                state.answer(sentence ?? '');
                setBuilt([]);
              }}
            >
              Check
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MatchBody({ widget, onEvent }: { widget: Widget; onEvent: WidgetCardProps['onEvent'] }) {
  const pairs = useMemo(() => widget.pairs ?? [], [widget.pairs]);
  const rights = useMemo(
    () =>
      shuffled(
        pairs.map((p, i) => ({ text: p[1], i })),
        widget.id
      ),
    [pairs, widget.id]
  );
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const finished = pairs.length > 0 && matched.length === pairs.length;

  const pickRight = (i: number) => {
    if (left === null || finished) return;
    if (i === left) {
      const next = [...matched, i];
      setMatched(next);
      if (next.length === pairs.length) {
        onEvent({
          action: 'done',
          summary:
            misses === 0
              ? `matched all ${pairs.length} pairs with no wrong tries`
              : `matched all ${pairs.length} pairs after ${misses} wrong ${misses === 1 ? 'try' : 'tries'}`,
        });
      }
    } else {
      setMisses((m) => m + 1);
      setFlash(i);
      window.setTimeout(() => setFlash(null), 600);
    }
    setLeft(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid content-start gap-2">
          {pairs.map(([text], i) => (
            <Tile
              key={i}
              mark={matched.includes(i) ? 'right' : left === i ? 'picked' : undefined}
              disabled={matched.includes(i)}
              onClick={() => setLeft(i)}
            >
              {text}
            </Tile>
          ))}
        </div>
        <div className="grid content-start gap-2">
          {rights.map(({ text, i }) => (
            <Tile
              key={i}
              mark={matched.includes(i) ? 'right' : flash === i ? 'wrong' : undefined}
              disabled={matched.includes(i) || left === null}
              onClick={() => pickRight(i)}
            >
              {text}
            </Tile>
          ))}
        </div>
      </div>
      {finished ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircleIcon weight="fill" /> All matched{misses ? '' : ', first time'}!
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Tap one on the left, then its match.</p>
      )}
    </div>
  );
}

function QuizBody({ widget, onEvent }: { widget: Widget; onEvent: WidgetCardProps['onEvent'] }) {
  const questions = widget.questions ?? [];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const q = questions[step];
  const picked = answers[step];
  const score = answers.filter((a, i) => questions[i]?.answer.includes(a)).length;
  const finished = answers.length === questions.length && step === questions.length - 1;

  const choose = (i: number) => {
    if (picked !== undefined) return;
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === questions.length) {
      const right = next.filter((a, n) => questions[n].answer.includes(a)).length;
      const missed = questions
        .map((qq, n) =>
          qq.answer.includes(next[n])
            ? null
            : `"${qq.question}" (answered "${qq.options[next[n]]}", right "${qq.options[qq.answer[0]]}")`
        )
        .filter(Boolean);
      onEvent({
        action: 'done',
        summary: `${right} of ${questions.length} right${missed.length ? `; missed ${missed.join('; ')}` : ''}`,
      });
    }
  };

  if (!q) return null;
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-1.5"
        aria-label={`Question ${step + 1} of ${questions.length}`}
      >
        {questions.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i < answers.length
                ? questions[i].answer.includes(answers[i])
                  ? 'bg-emerald-400/80'
                  : 'bg-rose-400/70'
                : i === step
                  ? 'bg-white/50'
                  : 'bg-white/15'
            )}
          />
        ))}
      </div>
      <p className="font-medium">{q.question}</p>
      <div className="grid gap-2">
        {q.options.map((option, i) => (
          <Tile
            key={i}
            letter={LETTERS[i]}
            mark={
              picked === undefined
                ? undefined
                : q.answer.includes(i)
                  ? 'right'
                  : picked === i
                    ? 'wrong'
                    : undefined
            }
            disabled={picked !== undefined}
            onClick={() => choose(i)}
          >
            {option}
          </Tile>
        ))}
      </div>
      {picked !== undefined && !finished && (
        <button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-sm"
        >
          Next
        </button>
      )}
      {finished && (
        <p className="text-sm">
          <span className="font-medium text-emerald-300">
            {score} / {questions.length}
          </span>{' '}
          <span className="text-muted-foreground">
            {score === questions.length ? 'All right!' : 'Your teacher will go over the rest.'}
          </span>
        </p>
      )}
    </div>
  );
}

export function WidgetCard({ widget, update, onEvent, onClose }: WidgetCardProps) {
  const state = useTries(widget, update, onEvent);
  const closed = ['choice', 'true_false', 'fill_blank', 'reorder'].includes(widget.kind);

  let body: React.ReactNode;
  switch (widget.kind) {
    case 'word_card':
      body = (
        <div className="space-y-1">
          <p className="text-2xl font-medium">{widget.word}</p>
          {widget.phonetic && <p className="text-muted-foreground">{widget.phonetic}</p>}
          {widget.meaning && <p>{widget.meaning}</p>}
          {widget.example && <p className="text-muted-foreground italic">“{widget.example}”</p>}
        </div>
      );
      break;
    case 'choice':
      body = <ChoiceBody widget={widget} state={state} />;
      break;
    case 'true_false':
      body = <TrueFalseBody widget={widget} state={state} />;
      break;
    case 'fill_blank':
      body = <FillBlankBody widget={widget} state={state} />;
      break;
    case 'reorder':
      body = <ReorderBody widget={widget} state={state} />;
      break;
    case 'match_pairs':
      body = <MatchBody widget={widget} onEvent={onEvent} />;
      break;
    case 'quiz':
      body = <QuizBody widget={widget} onEvent={onEvent} />;
      break;
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
    <LiquidGlass radius={28} tint={0.72} frost={18}>
      <section aria-label={KIND_LABEL[widget.kind]} className="space-y-3 p-5">
        <header className="flex items-center gap-2">
          <span className="label-mono text-white/60">
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
        {closed && <Feedback widget={widget} state={state} />}
        {closed &&
          !state.finished &&
          (widget.kind === 'choice' || widget.kind === 'true_false') && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <MicrophoneIcon /> Tap, or just say your answer.
            </p>
          )}
      </section>
    </LiquidGlass>
  );
}
