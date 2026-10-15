'use client';

import { useState } from 'react';
import { STICKERS, personaSummaries, stickerImageUrl } from '@speakwow/shared';
import { WidgetCard } from '@/components/app/widget-card';
import { teacherCardUrl } from '@/lib/teacher-card';
import type { Widget } from '@/lib/widgets';

/**
 * Every teaching card and sticker, without a call. For contributors working
 * on how they look; nothing here talks to LiveKit or a model.
 */
const SAMPLES: Widget[] = [
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
    answer: 'went',
  },
  { id: 'w3', kind: 'fill_blank', sentence: 'She ___ (be) my best friend.', answer: 'is' },
  {
    id: 'w4',
    kind: 'build_sentence',
    words: ['I', 'like', 'playing', 'football', 'after school'],
    answer: 'I like playing football after school',
  },
  {
    id: 'w5',
    kind: 'say_it',
    text: 'Nice to meet you. My name is Mei.',
    tip: 'Link "meet you" together: meet-chu.',
  },
  {
    id: 'w6',
    kind: 'goals',
    title: 'Unit 1 · This is me!',
    items: ['Introduce yourself', 'Talk about your hobbies', 'Use am / is / are'],
    done: [0],
  },
];

export default function Playground() {
  const [sent, setSent] = useState<string[]>([]);
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
      <div className="grid gap-4 md:grid-cols-2">
        {SAMPLES.map((w) => (
          <WidgetCard
            key={w.id}
            widget={w}
            onAnswer={(m) => setSent((s) => [...s, m])}
            onClose={() => undefined}
          />
        ))}
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
