/**
 * Teaching cards: small interactive cards the teacher puts on screen during a
 * call (see apps/agent/src/widgets.py, which validates what the model asks
 * for and keeps the answer key honest). Typed components, not model-written
 * HTML: they render instantly and cannot run anything.
 *
 * Closed questions are graded here for instant feedback, with the same rules
 * as the agent's grade(); both read apps/agent/tests/card_cases.json in their
 * tests. What the student does goes back on EVENT_TOPIC, never as a chat
 * line, so a tap never interrupts the teacher; the teacher hears about a card
 * once, when it is finished.
 */
export const WIDGET_TOPIC = 'speakwow.widget';
export const EVENT_TOPIC = 'speakwow.widget.event';

export const WIDGET_KINDS = [
  'word_card',
  'choice',
  'true_false',
  'fill_blank',
  'reorder',
  'match_pairs',
  'quiz',
  'say_it',
  'goals',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface QuizQuestion {
  question: string;
  options: string[];
  /** indexes of the right options */
  answer: number[];
}

export interface Widget {
  id: string;
  kind: WidgetKind;
  title?: string;
  hint?: string;
  explain?: string;
  // word_card
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  // choice
  question?: string;
  options?: string[];
  /** choice: indexes of the right options; true_false: the truth; fill_blank / reorder: the text */
  answer?: number[] | boolean | string;
  multi?: boolean;
  // true_false
  statement?: string;
  // fill_blank
  sentence?: string;
  accept?: string[];
  // reorder
  words?: string[];
  // match_pairs
  pairs?: [string, string][];
  // quiz
  questions?: QuizQuestion[];
  // say_it
  text?: string;
  tip?: string;
  // goals
  items?: string[];
  done?: number[];
  maxAttempts: number;
}

/** A spoken answer the teacher marked (mark_card): shown as if tapped. */
export interface CardUpdate {
  cardId: string;
  given: string;
  correct: boolean;
  attempt: number;
  final: boolean;
}

export const LETTERS = 'ABCDEF';

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
const indexes = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : undefined;

function decode(payload: Uint8Array | string): Record<string, unknown> | null {
  try {
    const raw = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Defensive parse of a card from the data channel; null for anything unexpected. */
export function parseWidget(payload: Uint8Array | string): Widget | null {
  const data = decode(payload);
  if (data?.type !== 'widget' || !WIDGET_KINDS.includes(data.kind as WidgetKind)) return null;
  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : undefined);
  const kind = data.kind as WidgetKind;
  let answer: Widget['answer'];
  if (kind === 'choice') answer = indexes(data.answer);
  else if (kind === 'true_false')
    answer = typeof data.answer === 'boolean' ? data.answer : undefined;
  else answer = text('answer');
  const pairs = Array.isArray(data.pairs)
    ? (data.pairs as unknown[]).filter(
        (p): p is [string, string] =>
          Array.isArray(p) && p.length === 2 && p.every((s) => typeof s === 'string')
      )
    : undefined;
  const questions = Array.isArray(data.questions)
    ? (data.questions as Record<string, unknown>[])
        .map((q) => ({
          question: typeof q?.question === 'string' ? q.question : '',
          options: strings(q?.options) ?? [],
          answer: indexes(q?.answer) ?? [],
        }))
        .filter((q) => q.question && q.options.length >= 2 && q.answer.length)
    : undefined;
  return {
    id: text('id') ?? String(Date.now()),
    kind,
    title: text('title'),
    hint: text('hint'),
    explain: text('explain'),
    word: text('word'),
    phonetic: text('phonetic'),
    meaning: text('meaning'),
    example: text('example'),
    question: text('question'),
    options: strings(data.options),
    answer,
    multi: data.multi === true,
    statement: text('statement'),
    sentence: text('sentence'),
    accept: strings(data.accept),
    words: strings(data.words),
    pairs,
    questions,
    text: text('text'),
    tip: text('tip'),
    items: strings(data.items),
    done: indexes(data.done),
    maxAttempts: Number.isInteger(data.max_attempts) ? (data.max_attempts as number) : 1,
  };
}

export function parseCardUpdate(payload: Uint8Array | string): CardUpdate | null {
  const data = decode(payload);
  if (data?.type !== 'card_update' || typeof data.card_id !== 'string') return null;
  return {
    cardId: data.card_id,
    given: typeof data.given === 'string' ? data.given : '',
    correct: data.correct === true,
    attempt: Number.isInteger(data.attempt) ? (data.attempt as number) : 1,
    final: data.final === true,
  };
}

/** The comparison both graders use (widgets.py norm). */
export function normAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”]+|["'“”.!?,;:。！？，]+$/g, '')
    .trim();
}

function optionIndex(options: string[], given: string): number | null {
  const i = options.findIndex((o) => normAnswer(o) === normAnswer(given));
  return i < 0 ? null : i;
}

/** Which options an answer names: their text, or letters ("B", "a and c"). */
function choices(options: string[], given: string): Set<number> | null {
  const whole = optionIndex(options, given);
  if (whole !== null) return new Set([whole]);
  const picked = new Set<number>();
  for (const raw of normAnswer(given).split(/,|\band\b|和|、|\s+/)) {
    const part = raw.replace(/^option/, '').trim();
    if (!part) continue;
    const letter =
      part.length === 1 ? LETTERS.slice(0, options.length).indexOf(part.toUpperCase()) : -1;
    const index = letter >= 0 ? letter : optionIndex(options, part);
    if (index === null) return null;
    picked.add(index);
  }
  return picked.size ? picked : null;
}

/** The option indexes an answer names, for showing which were picked. */
export function namedOptions(widget: Widget, given: string): number[] {
  return [...(choices(widget.options ?? [], given) ?? [])];
}

const TRUE_WORDS = new Set(['true', 'yes', 'right', 'correct', '对', '是', '正确']);
const FALSE_WORDS = new Set(['false', 'no', 'wrong', 'not true', '错', '不对', '错误']);

/** true / false for a closed question; null when the answer is not one of the card's. */
export function gradeCard(widget: Widget, given: string): boolean | null {
  switch (widget.kind) {
    case 'choice': {
      const picked = choices(widget.options ?? [], given);
      const right = new Set(Array.isArray(widget.answer) ? widget.answer : []);
      return picked === null
        ? null
        : picked.size === right.size && [...picked].every((i) => right.has(i));
    }
    case 'true_false': {
      const said = normAnswer(given);
      if (TRUE_WORDS.has(said)) return widget.answer === true;
      if (FALSE_WORDS.has(said)) return widget.answer === false;
      return null;
    }
    case 'fill_blank': {
      const accepted = new Set(
        [String(widget.answer ?? ''), ...(widget.accept ?? [])].map(normAnswer)
      );
      return accepted.has(normAnswer(given));
    }
    case 'reorder':
      return normAnswer(given) === normAnswer(String(widget.answer ?? ''));
    default:
      return null;
  }
}

/** The right answer, as the card shows it once revealed. */
export function rightAnswer(widget: Widget): string {
  if (widget.kind === 'choice' && Array.isArray(widget.answer)) {
    return widget.answer.map((i) => widget.options?.[i] ?? '').join(', ');
  }
  if (widget.kind === 'true_false') return widget.answer ? 'True' : 'False';
  return String(widget.answer ?? '');
}

export type CardAction =
  | { action: 'answer'; given: string }
  | { action: 'hint' }
  | { action: 'reveal' }
  | { action: 'done'; summary: string };

/** What the student did, for EVENT_TOPIC. */
export function cardEvent(widget: Widget, action: CardAction): string {
  return JSON.stringify({ type: 'card_event', card_id: widget.id, ...action });
}
