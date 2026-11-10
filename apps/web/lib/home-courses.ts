import 'server-only';
import { OFFERED_SUBJECTS } from '@/lib/course-catalog';
import { type HomeLibrary, studySessions } from '@/lib/study-plan';
import { getSessionUser } from '@/lib/supabase/server';

export async function homeCourses(): Promise<HomeLibrary> {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { courses: [], selectedId: null, configured: false };
  const [catalog, enrollments] = await Promise.all([
    supabase
      .from('courses')
      .select('id,slug,grade,title,description,units:course_units(id,title,position,content,goals)')
      .in('subject', OFFERED_SUBJECTS)
      .order('title')
      .limit(100),
    user
      ? supabase
          .from('enrollments')
          .select('course_id,current_unit_id,status,updated_at')
          .eq('student_id', user.id)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (catalog.error || enrollments.error)
    throw new Error('Courses could not be loaded. Please try again.');
  const ids = (catalog.data ?? []).flatMap((c) => c.units.map((u) => u.id));
  const progress =
    user && ids.length
      ? await supabase
          .from('unit_progress')
          .select('unit_id,status,mastery,session_progress')
          .eq('student_id', user.id)
          .in('unit_id', ids)
      : { data: [], error: null };
  if (progress.error) throw new Error('Your progress could not be loaded. Please try again.');
  return {
    configured: true,
    selectedId: enrollments.data?.find((e) => e.status === 'active')?.course_id ?? null,
    courses: (catalog.data ?? []).map((course) => {
      const enrollment = enrollments.data?.find((e) => e.course_id === course.id);
      const units = course.units
        .sort((a, b) => a.position - b.position)
        .map((unit) => ({
          id: unit.id,
          title: unit.title,
          description:
            unit.content?.sessions?.length === 1 && unit.content.sessions[0].kind === 'exam'
              ? 'Bring together what you have learned in an independent assessment.'
              : (unit.goals?.[0]?.text ?? ''),
          position: unit.position,
          sessions: studySessions(unit.content, unit.goals),
          progress: progress.data?.find((p) => p.unit_id === unit.id),
        }));
      return {
        id: course.id,
        slug: course.slug,
        grade: course.grade,
        title: course.title,
        description: course.description,
        units,
        currentUnitId: enrollment?.current_unit_id ?? units[0]?.id ?? '',
        started: Boolean(enrollment),
      };
    }),
  };
}
