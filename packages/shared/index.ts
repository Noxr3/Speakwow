/**
 * @speakwow/shared — data both apps read: persona cards and the sticker set.
 * A new teacher is one JSON file in personas/ plus one line in PERSONA_CARDS.
 */
import diego from './personas/diego.json';
import frank from './personas/frank.json';
import grace from './personas/grace.json';
import kai from './personas/kai.json';
import leo from './personas/leo.json';
import lily from './personas/lily.json';
import lucy from './personas/lucy.json';
import max from './personas/max.json';
import nora from './personas/nora.json';
import priya from './personas/priya.json';
import stickerData from './stickers.json';
import type { PersonaCard, Sticker, TeacherMotif } from './types';

export * from './types';

export const PERSONA_CARDS = [
  frank,
  lucy,
  lily,
  leo,
  kai,
  grace,
  diego,
  priya,
  nora,
  max,
] as unknown as PersonaCard[];

export const DEFAULT_PERSONA_ID = 'frank';

/** What the picker shows. Never ship personality prompts to the browser. */
export interface PersonaSummary {
  id: string;
  display_name: string;
  tagline: string;
  tagline_en: string;
  accent: string;
  accent_tag: string;
  teaching_style: string;
  specialty_en: string;
  colors: [string, string];
  motif: TeacherMotif;
  /** what is going on in the teacher's life today, e.g. "Learning Japanese for a Tokyo trip" */
  now: string | null;
}

/** Days since 0001-01-01, matching Python's date.toordinal() used by the agent. */
export function dayOrdinal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000) + 719_163;
}

/** Days each beat of a storyline lasts; apps/agent/src/life.py uses the same. */
export const DAYS_PER_BEAT = 3;

/**
 * The storyline playing today: one at a time, a beat every few days, the next
 * one starting when it ends. Mirrors story_position() in apps/agent/src/life.py,
 * so the card shows what the teacher talks about.
 */
export function lifeHeadline(card: PersonaCard, date: Date = new Date()): string | null {
  const threads = (card.life?.threads ?? []).filter((t) => t.beats?.length);
  const total = threads.reduce((sum, t) => sum + t.beats.length, 0);
  if (!total) return null;
  let step = Math.floor(dayOrdinal(date) / DAYS_PER_BEAT) % total;
  for (const thread of threads) {
    if (step < thread.beats.length) return thread.headline ?? null;
    step -= thread.beats.length;
  }
  return null;
}

export function personaSummaries(date: Date = new Date()): PersonaSummary[] {
  return PERSONA_CARDS.map((card) => ({
    id: card.id,
    display_name: card.display_name,
    tagline: card.tagline,
    tagline_en: card.tagline_en,
    accent: card.accent,
    accent_tag: card.accent_tag,
    teaching_style: card.teaching_style,
    specialty_en: card.specialty_en ?? '',
    colors: card.look?.colors ?? ['#1fd5f9', '#00ff6a'],
    motif: card.look?.motif ?? 'bars',
    now: lifeHeadline(card, date),
  }));
}

/** Matches an id ("lucy") or a legacy display name ("Lucy"). */
export function resolvePersonaId(requested: unknown): string {
  if (typeof requested === 'string') {
    const key = requested.trim().toLowerCase();
    const card = PERSONA_CARDS.find((c) => c.id === key || c.display_name.toLowerCase() === key);
    if (card) return card.id;
  }
  return DEFAULT_PERSONA_ID;
}

export const STICKERS = stickerData.stickers as Sticker[];
export const STICKER_TOPIC = 'speakwow.sticker';

/** Noto Animated Emoji (CC BY 4.0); callers fall back to `emoji` on error. */
export function stickerImageUrl(sticker: Sticker): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${sticker.code}/512.webp`;
}
