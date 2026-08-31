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
  gender: 'male' | 'female';
  /** e.g. "American" | "RP British" */
  accent: string;
  accent_tag: string;
  /** e.g. "encourage" | "rigorous" (display only) */
  teaching_style: string;
  /** realtime voice candidate — C2 audition decides final value */
  voice: string;
  language_policy: string;
  /** system prompt body */
  personality: string;
  openings: {
    casual: string[];
    /** used when a student snapshot with pending work/weaknesses is injected */
    learning: string[];
  };
  /** shared guidance decisions, persona-flavoured expression */
  guidance_style: { scenario: string; expression: string }[];
  /** pointer only — the red lines themselves are injected by the shared teacher layer */
  boundaries: string;
}

// ---------- Core DB rows (mirror of public schema) ----------

export type ExerciseType =
  | 'scenario' | 'talkabout' | 'repeat' | 'word'
  | 'dictation' | 'reading' | 'write';

export type WeaknessSource = 'live_session' | 'exercise';

export interface Profile {
  id: string;
  display_name: string | null;
  level: string | null;
  points: number;
  preferred_topics: string[];
  selected_textbook_id: string | null;
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
  student: { display_name: string; level: string | null; preferred_topics: string[] };
  current_course: { title: string; current_unit: string; progress: number } | null;
  pending_assignments: { title: string; type: string; due: string }[];
  top_weaknesses: { item: string; source: WeaknessSource; last_seen: string }[];
  last_session: { at: string; summary: string } | null;
}
