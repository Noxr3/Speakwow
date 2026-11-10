export interface StudySession {
  id: string;
  title: string;
  kind: 'lesson' | 'practice' | 'review' | 'exam';
  activity: string;
  goal_ids: string[];
  minutes?: number;
}
export interface StudyProgress {
  status?: string;
  mastery?: number;
  session_progress?: Record<string, { status: string; mastery: number }>;
}
export function studySessions(
  content: Record<string, unknown> | null,
  goals: { id: string }[] = []
): StudySession[] {
  if (Array.isArray(content?.sessions) && content.sessions.length)
    return content.sessions as StudySession[];
  return [
    { id: 'learn', title: 'Learn together', kind: 'lesson' as const },
    { id: 'practice', title: 'Make it your own', kind: 'practice' as const },
    { id: 'check', title: 'Independent check', kind: 'exam' as const },
  ].map((s) => ({ ...s, activity: 'mixed', goal_ids: goals.map((g) => g.id) }));
}
export function completedSessions(sessions: StudySession[], progress?: StudyProgress): number {
  if (progress?.status === 'mastered' && !Object.keys(progress.session_progress ?? {}).length)
    return sessions.length;
  return sessions.filter((s) => progress?.session_progress?.[s.id]?.status === 'mastered').length;
}
export interface HomeUnit {
  id: string;
  title: string;
  description?: string;
  position: number;
  sessions: StudySession[];
  progress?: StudyProgress;
}
export interface HomeCourse {
  id: string;
  slug?: string | null;
  grade?: string | null;
  title: string;
  description: string | null;
  units: HomeUnit[];
  currentUnitId: string;
  started: boolean;
}
export interface HomeLibrary {
  courses: HomeCourse[];
  selectedId: string | null;
  configured: boolean;
  error?: string;
}
export function coursePosition(course: HomeCourse) {
  const total = course.units.reduce((n, u) => n + u.sessions.length, 0);
  const completed = course.units.reduce((n, u) => n + completedSessions(u.sessions, u.progress), 0);
  const unit = course.units.find((u) => u.id === course.currentUnitId) ?? course.units[0];
  const session = unit?.sessions.find(
    (s) => unit.progress?.session_progress?.[s.id]?.status !== 'mastered'
  );
  return {
    total,
    completed,
    unit,
    session: completed === total && total > 0 ? undefined : session,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
