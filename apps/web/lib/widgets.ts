/**
 * Teaching widgets: small interactive cards the teacher puts on screen during
 * a call (see apps/agent/src/widgets.py, which validates what the model asks
 * for). Typed components, not model-written HTML: they render instantly and
 * cannot run anything. The student's answer goes back to the teacher as a
 * chat message that starts with "[widget]".
 */
export const WIDGET_TOPIC = 'speakwow.widget';

export const WIDGET_KINDS = [
  'word_card',
  'choice',
  'fill_blank',
  'build_sentence',
  'say_it',
  'goals',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface Widget {
  id: string;
  kind: WidgetKind;
  title?: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  question?: string;
  sentence?: string;
  text?: string;
  tip?: string;
  options?: string[];
  words?: string[];
  items?: string[];
  done?: number[];
  answer?: string;
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;

/** Defensive parse of a data-channel payload; null for anything unexpected. */
export function parseWidget(payload: Uint8Array | string): Widget | null {
  try {
    const raw = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const data = JSON.parse(raw);
    if (data?.type !== 'widget' || !WIDGET_KINDS.includes(data.kind)) return null;
    const text = (key: string) => (typeof data[key] === 'string' ? data[key] : undefined);
    return {
      id: text('id') ?? String(Date.now()),
      kind: data.kind,
      title: text('title'),
      word: text('word'),
      phonetic: text('phonetic'),
      meaning: text('meaning'),
      example: text('example'),
      question: text('question'),
      sentence: text('sentence'),
      text: text('text'),
      tip: text('tip'),
      answer: text('answer'),
      options: strings(data.options),
      words: strings(data.words),
      items: strings(data.items),
      done: Array.isArray(data.done) ? data.done.filter(Number.isInteger) : undefined,
    };
  } catch {
    return null;
  }
}

/** True when the student's answer matches, ignoring case, spacing and end punctuation. */
export function sameAnswer(given: string, expected: string | undefined): boolean | null {
  if (!expected) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?,;:]+$/, '');
  return norm(given) === norm(expected);
}

/** The chat line the teacher receives. */
export function answerMessage(widget: Widget, answer: string, correct: boolean | null): string {
  const verdict = correct === null ? '' : correct ? ' (correct)' : ' (not correct)';
  return `[widget ${widget.kind}] ${answer}${verdict}`;
}
