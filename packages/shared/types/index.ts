/**
 * Speakwow shared types — keep aligned with supabase/migrations/0001_core_schema.sql
 */

// ---------- Persona cards (packages/shared/personas/*.json) ----------

export interface PersonaCard {
  /** stable id, e.g. "frank" | "lucy" */
  id: string;
  display_name: string;
  /** one-line persona for the teacher-picker page (display only, never in prompt) */
  tagline: string;
  /** the same in English, for the default (English) UI */
  tagline_en: string;
  gender: 'male' | 'female';
  /** e.g. "American" | "RP British" */
  accent: string;
  accent_tag: string;
  /** e.g. "encourage" | "rigorous" (display only) */
  teaching_style: string;
  /** legacy: the xAI voice. Prefer `voices`. */
  voice: string;
  /** realtime voice per provider, e.g. { xai: "Rex", openai: "cedar" } */
  voices: Partial<Record<'xai' | 'openai', string>>;
  language_policy: string;
  /** system prompt body */
  personality: string;
  /** how the voice should sound, rendered into the prompt per realtime model */
  voice_note?: string;
  /** a few short reactions in this teacher's voice; tone examples, never questions */
  tone_lines?: string[];
  openings: {
    /** first meeting: said word for word, says it is an AI teacher, ends without a question */
    greeting: string[];
    /** returning student: the tone of the hello, ends without a question */
    welcome_back: string[];
    /** chat topics for getting to know the student, used one at a time; never drills */
    starters: string[];
  };
  /** this teacher's practice games and drills, offered only once the student is ready */
  activities?: string[];
  /** shared guidance decisions, persona-flavoured expression */
  guidance_style: { scenario: string; expression: string }[];
  /** pointer only — the red lines themselves are injected by the shared teacher layer */
  boundaries: string;
  /** the teacher's own life: who they are and storylines that move forward over time */
  life?: {
    about?: string;
    routine?: string[];
    loves?: string[];
    dislikes?: string[];
    opinions?: string[];
    threads?: { title: string; headline?: string; beats: string[] }[];
  };
  /** the picker card: what they are best at, and their two signature colours */
  specialty_en?: string;
  specialty?: string;
  look?: { colors: [string, string]; motif?: TeacherMotif };
  /** one line in character, read aloud as the voice sample on the picker */
  sample_line?: string;
}

/** The animated voiceprint drawn on the teacher's card (apps/web/lib/teacher-card.ts). */
export type TeacherMotif =
  | 'bars'
  | 'wave'
  | 'rings'
  | 'dots'
  | 'pixels'
  | 'radial'
  | 'flame'
  | 'orbit'
  | 'strings'
  | 'ripple';

// ---------- Stickers (packages/shared/stickers.json) ----------

export interface Sticker {
  id: string;
  emoji: string;
  /** Noto Animated Emoji file name, e.g. "1f602" */
  code: string;
  label: string;
  /** when the teacher should use it (goes into the agent prompt) */
  when: string;
}

// ---------- Core DB rows (mirror of public schema) ----------

export type ExerciseType =
  | 'scenario' | 'talkabout' | 'repeat' | 'word'
  | 'dictation' | 'reading' | 'write';

export type WeaknessSource = 'live_session' | 'exercise';

/** Account identity and course/billing state; learner understanding lives in memory. */
export interface Profile {
  id: string;
  points: number;
  selected_textbook_id: string | null;
}

export interface UserMemory {
  id: string;
  key: string;
  content: string;
  source_session_id: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface Session {
  id: string;
  student_id: string;
  persona_id: string;
  assignment_id: string | null;
  room_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  summary: string | null;
}

export interface Attempt {
  id: string;
  student_id: string;
  type: ExerciseType;
  exercise_id: string | null;
  assignment_id: string | null;
  session_id: string | null;
  score: number | null;
  report: Record<string, unknown> | null;
  item_records: Record<string, unknown>[] | null;
  is_finished: boolean;
}

export interface Weakness {
  id: string;
  student_id: string;
  item: string;
  source: WeaknessSource;
  evidence: Record<string, unknown> | null;
}

/** StudentSnapshot v0 — injected into the teacher persona at session start */
export interface StudentSnapshot {
  memories: UserMemory[];
  current_course: { title: string; current_unit: string; progress: number } | null;
  pending_assignments: { title: string; type: string; due: string }[];
  top_weaknesses: { item: string; source: WeaknessSource; last_seen: string }[];
  last_session: { at: string; summary: string } | null;
}
