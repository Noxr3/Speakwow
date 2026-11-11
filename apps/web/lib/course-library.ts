import {
  type HomeCourse,
  type HomeLibrary,
  type StudyProgress,
  studySessions,
} from './study-plan.ts';

export interface CatalogCourse {
  id: string;
  slug: string | null;
  grade: string | null;
  title: string;
  description: string | null;
  units: {
    id: string;
    title: string;
    position: number;
    sessions: unknown;
    goals: { id: string; text?: string }[] | null;
  }[];
}
export interface Enrollment {
  course_id: string;
  current_unit_id: string | null;
  status: string;
}
export type UnitProgress = StudyProgress & { unit_id: string };

/** Explicit projection keeps teaching prompts and lesson materials out of navigation payloads. */
export function publicCourse(course: CatalogCourse): HomeCourse {
  const units = [...course.units]
    .sort((a, b) => a.position - b.position)
    .map((unit) => {
      const sessions = studySessions({ sessions: unit.sessions }, unit.goals ?? []).map(
        ({ id, title, kind, activity, goal_ids, minutes }) => ({
          id,
          title,
          kind,
          activity,
          goal_ids,
          minutes,
        })
      );
      return {
        id: unit.id,
        title: unit.title,
        position: unit.position,
        sessions,
        description:
          sessions.length === 1 && sessions[0].kind === 'exam'
            ? 'Bring together what you have learned in an independent assessment.'
            : (unit.goals?.[0]?.text ?? ''),
      };
    });
  return {
    id: course.id,
    slug: course.slug,
    grade: course.grade,
    title: course.title,
    description: course.description,
    units,
    currentUnitId: units[0]?.id ?? '',
    started: false,
  };
}

/** Never mutate shared public data or cache this personalized result across requests. */
export function personalizeCourses(
  catalog: HomeCourse[],
  enrollments: Enrollment[],
  progress: UnitProgress[],
  selectedOnly = false
): HomeLibrary {
  const selectedId = enrollments.find((e) => e.status === 'active')?.course_id ?? null;
  const enrollmentMap = new Map(enrollments.map((e) => [e.course_id, e]));
  const progressMap = new Map(progress.map((p) => [p.unit_id, p]));
  return {
    configured: true,
    selectedId,
    courses: catalog
      .filter((c) => !selectedOnly || c.id === selectedId)
      .map((course) => {
        const enrollment = enrollmentMap.get(course.id);
        return {
          ...course,
          currentUnitId: enrollment?.current_unit_id ?? course.currentUnitId,
          started: Boolean(enrollment),
          units: course.units.map((unit) => ({ ...unit, progress: progressMap.get(unit.id) })),
        };
      }),
  };
}
