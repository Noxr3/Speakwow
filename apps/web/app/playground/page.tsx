'use client';

import { useState } from 'react';
import { STICKERS, personaSummaries, stickerImageUrl } from '@speakwow/shared';
import DotGrid from '@/components/DotGrid';
import { controlBarToggleClassName } from '@/components/agents-ui/agent-control-bar';
import { ReactionPicker } from '@/components/app/reaction-picker';
import { WidgetCard } from '@/components/app/widget-card';
import { teacherCardUrl } from '@/lib/teacher-card';
import { type CardUpdate, type Widget, parseWidget } from '@/lib/widgets';

/**
 * Every teaching card and sticker, without a call. For contributors working
 * on how they look; nothing here talks to LiveKit or a model. The samples are
 * written as the agent sends them (apps/agent/src/widgets.py validate()).
 */
const RAW = [
  {
    id: 'w1',
    kind: 'word_card',
    word: 'comfortable',
    phonetic: '/ˈkʌmftəbl/',
    meaning: '舒服的，舒适的',
    example: 'This sofa is really comfortable.',
  },
  {
    id: 'w2',
    kind: 'choice',
    question: 'Yesterday I ___ to the park with my sister.',
    options: ['go', 'went', 'goed', 'going'],
    answer: [1],
    max_attempts: 2,
    hint: 'It happened yesterday: use the past.',
    explain: '"Go" is irregular: go → went.',
  },
  {
    id: 'w3',
    kind: 'choice',
    question: 'Which of these are fruit?',
    options: ['apple', 'chair', 'banana', 'desk'],
    answer: [0, 2],
    multi: true,
    max_attempts: 2,
  },
  {
    id: 'w4',
    kind: 'true_false',
    statement: '"Their" and "there" mean the same thing.',
    answer: false,
    max_attempts: 1,
    explain: '"Their" means it belongs to them; "there" is a place.',
  },
  {
    id: 'w5',
    kind: 'fill_blank',
    sentence: 'I like ___ basketball.',
    options: ['play', 'playing', 'plays'],
    answer: 'playing',
    accept: [],
    max_attempts: 2,
    hint: 'like + -ing',
  },
  {
    id: 'w6',
    kind: 'fill_blank',
    sentence: 'She ___ my best friend.',
    answer: 'is',
    accept: ["'s"],
    max_attempts: 2,
    hint: 'She + be = ?',
  },
  {
    id: 'w7',
    kind: 'reorder',
    words: ['I', 'like', 'playing', 'football', 'after', 'school'],
    answer: 'I like playing football after school',
    max_attempts: 2,
  },
  {
    id: 'w8',
    kind: 'match_pairs',
    pairs: [
      ['apple', '苹果'],
      ['cat', '猫'],
      ['school', '学校'],
    ],
    max_attempts: 1,
  },
  {
    id: 'w9',
    kind: 'quiz',
    questions: [
      { question: 'I ___ a student.', options: ['am', 'is', 'are'], answer: [0] },
      { question: 'They ___ my friends.', options: ['am', 'is', 'are'], answer: [2] },
      { question: 'He ___ twelve.', options: ['am', 'is', 'are'], answer: [1] },
    ],
    max_attempts: 1,
  },
  {
    id: 'w10',
    kind: 'say_it',
    text: 'Nice to meet you. My name is Mei.',
    tip: 'Link "meet you" together: meet-chu.',
  },
  {
    id: 'w11',
    kind: 'goals',
    title: 'Unit 1 · This is me!',
    items: ['Introduce yourself', 'Talk about your hobbies', 'Use am / is / are'],
    done: [0],
  },
];
const SAMPLES: Widget[] = RAW.map((r) => parseWidget(JSON.stringify({ type: 'widget', ...r }))!);

export default function Playground() {
  const [sent, setSent] = useState<string[]>([]);
  const [update, setUpdate] = useState<CardUpdate | null>(null);
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-24">
      <h1 className="text-foreground text-2xl font-bold">Playground</h1>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
        data-testid="teacher-cards"
      >
        {personaSummaries().map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={teacherCardUrl(p)}
            alt={p.display_name}
            className="w-full rounded-2xl"
          />
        ))}
      </div>
      <section className="space-y-2" data-testid="call-preview">
        <h2 className="text-foreground font-semibold">On the call screen</h2>
        <p className="text-muted-foreground text-sm">
          A card over the call&apos;s background and transcript, and the reaction picker: hover the
          smiley with a mouse, tap it on a phone.
        </p>
        <div className="relative h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-black">
          <div className="absolute inset-0">
            <DotGrid
              dotSize={5}
              gap={15}
              baseColor="#20381f"
              activeColor="#0c9215"
              proximity={120}
              shockRadius={250}
              shockStrength={5}
              resistance={750}
              returnDuration={1.5}
            />
          </div>
          {/* the teacher's voice bars as in a call (tile-layout: five pills,
              scaled 4x, white while the teacher speaks), right behind the card */}
          <div className="absolute inset-x-0 top-24 flex h-64 items-center justify-center gap-4">
            {[90, 170, 230, 150, 100].map((h, i) => (
              <span key={i} className="bg-foreground w-10 rounded-full" style={{ height: h }} />
            ))}
          </div>
          <div className="absolute inset-x-6 bottom-28 space-y-2 text-sm leading-relaxed">
            <p className="text-white/85">Frank: What did you do last weekend?</p>
            <p className="text-right text-white/85">I went to the park with my sister.</p>
            <p className="text-white/85" data-testid="last-caption">
              Frank: Nice! Which part of the park do you like best?
            </p>
          </div>
          <div className="absolute inset-x-3 top-6 mx-auto max-w-md">
            <WidgetCard
              widget={SAMPLES[1]}
              update={null}
              onEvent={(action) => setSent((s) => [...s, `w2 ${JSON.stringify(action)}`])}
              onClose={() => undefined}
            />
          </div>
          <div className="absolute inset-x-3 bottom-4">
            <div className="relative mx-auto max-w-2xl">
              <div className="bg-background border-input/50 flex gap-1 rounded-[31px] border p-3">
                <ReactionPicker
                  onPick={(sticker) => setSent((s) => [...s, `sticker ${sticker.emoji}`])}
                  className={controlBarToggleClassName()}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {SAMPLES.map((w) => (
          <div key={w.id} data-card={w.id}>
            <WidgetCard
              widget={w}
              update={update?.cardId === w.id ? update : null}
              onEvent={(action) => setSent((s) => [...s, `${w.id} ${JSON.stringify(action)}`])}
              onClose={() => undefined}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          data-testid="voice-b"
          className="text-muted-foreground text-xs underline"
          onClick={() =>
            setUpdate({ cardId: 'w2', given: 'B', correct: true, attempt: 1, final: true })
          }
        >
          Teacher marks &ldquo;B&rdquo; by voice on w2
        </button>
      </div>
      <div>
        <h2 className="text-foreground mb-2 font-semibold">Sent to the teacher</h2>
        <pre className="text-muted-foreground text-xs" data-testid="sent">
          {sent.join('\n') || '—'}
        </pre>
      </div>
      <div className="flex flex-wrap gap-3">
        {STICKERS.map((s) => (
          <figure key={s.id} className="flex w-16 flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stickerImageUrl(s)} alt={s.label} width={48} height={48} />
            <figcaption className="text-muted-foreground text-[10px]">{s.id}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
