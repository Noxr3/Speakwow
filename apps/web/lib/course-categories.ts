/** Navigation taxonomy. Keep membership keyed by stable course slugs, not display names. */
export const COURSE_CATEGORIES = [
  {
    id: 'adult-english',
    title: 'Adult English',
    description: 'Conversation, pronunciation and everyday language skills.',
  },
  {
    id: 'ielts-toefl',
    title: 'IELTS & TOEFL',
    description: 'English proficiency and study-abroad preparation.',
  },
  {
    id: 'school-english',
    title: 'School English',
    description: 'Textbook courses by grade and term.',
  },
  { id: 'more-english', title: 'More English', description: 'Explore other English courses.' },
] as const;
export type CourseCategoryId = (typeof COURSE_CATEGORIES)[number]['id'];
const ADULT_COURSES = new Set([
  'everyday-conversations',
  'picture-conversations',
  'pronunciation-rhythm',
  'listen-and-write',
  'words-in-use',
  'read-and-discover',
  'writing-workshop',
  'storytelling',
]);

export function courseCategory(course: {
  slug?: string | null;
  grade?: string | null;
}): CourseCategoryId {
  if (/^(ielts|toefl)(-|$)/.test(course.slug ?? '')) return 'ielts-toefl';
  if (course.grade?.trim()) return 'school-english';
  if (ADULT_COURSES.has(course.slug ?? '')) return 'adult-english';
  // New courses stay discoverable until their audience is explicitly classified.
  return 'more-english';
}

export function findCourseCategory(value?: string | string[]) {
  return COURSE_CATEGORIES.find((category) => category.id === value) ?? null;
}
export function categoryHref(id: CourseCategoryId) {
  return `/courses?category=${encodeURIComponent(id)}`;
}

export const CEFR_LEVELS = [
  { id: 'A1', description: 'Simple words, familiar phrases and basic exchanges.' },
  { id: 'A2', description: 'Routine conversations and short, straightforward messages.' },
  { id: 'B1', description: 'Connected speech, personal experiences and reasons for opinions.' },
  { id: 'B2', description: 'Detailed discussion, complex texts and supported arguments.' },
  {
    id: 'C1',
    description: 'Flexible, precise language for complex academic and professional work.',
  },
  { id: 'C2', description: 'Nuanced expression and effortless understanding across contexts.' },
] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number]['id'];
export const CEFR_SOURCE =
  'https://www.coe.int/en/web/common-European-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale';

/** Editorial alignment of the current goals, not a learner assessment or certificate.
 * Keep the rationale in docs/COURSE_SERIES.md when a series changes. School grades
 * are deliberately not converted into CEFR without a curriculum alignment review.
 */
const COURSE_LEVELS: Record<string, readonly [CefrLevel, CefrLevel]> = {
  'listen-and-write': ['A1', 'A2'],
  'pronunciation-rhythm': ['A1', 'A2'],
  'everyday-conversations': ['A2', 'B1'],
  'picture-conversations': ['A2', 'B1'],
  'words-in-use': ['A2', 'B1'],
  'read-and-discover': ['A2', 'B1'],
  'writing-workshop': ['A2', 'B1'],
  storytelling: ['B1', 'B1'],
};
export function findCefrLevel(value?: string | string[]) {
  return CEFR_LEVELS.find((level) => level.id === value) ?? null;
}
export function courseLevels(course: { slug?: string | null }) {
  return COURSE_LEVELS[course.slug ?? ''] ?? null;
}
export function courseLevelLabel(course: { slug?: string | null; grade?: string | null }) {
  const range = courseLevels(course);
  return range
    ? range[0] === range[1]
      ? range[0]
      : `${range[0]}–${range[1]}`
    : course.grade
      ? `Grade ${course.grade}`
      : 'Level not yet mapped';
}
export function matchesCourseLevel(course: { slug?: string | null }, level: CefrLevel | null) {
  if (!level) return true;
  const range = courseLevels(course);
  if (!range) return false;
  const rank = (id: CefrLevel) => CEFR_LEVELS.findIndex((item) => item.id === id);
  return rank(level) >= rank(range[0]) && rank(level) <= rank(range[1]);
}
export function courseLevelHref(category: CourseCategoryId | null, level: CefrLevel | null) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (level) params.set('level', level);
  return `/courses${params.size ? `?${params}` : ''}`;
}
