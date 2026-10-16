/**
 * The course catalogue as the web shows it. Courses come from the repository
 * (courses/) and are imported by the server; any visitor may read them.
 */

/** How a course's `subject` reads on the page. */
export const SUBJECT_LABEL: Record<string, string> = {
  english: 'English',
  'venture-fundraising': 'Fundraising',
};

/**
 * Subjects the teacher teaches today. Speakwow focuses on language learning
 * for now, so courses in other subjects (the fundraising one) are not listed.
 */
export const READY_SUBJECTS = new Set(['english']);

export function subjectLabel(subject: string | null | undefined): string {
  if (!subject) return 'Other';
  return SUBJECT_LABEL[subject] ?? subject.replace(/-/g, ' ');
}

export function gradeLabel(grade: string | null | undefined): string | null {
  return grade && /^\d+$/.test(grade) ? `Grade ${grade}` : null;
}

/** Same-site paths only, so ?next= cannot send someone to another site. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}
