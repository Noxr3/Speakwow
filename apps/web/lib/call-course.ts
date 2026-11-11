import type { SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve only after the caller has verified the session. select_course validates
 * ownership and unit membership atomically under the caller's authenticated JWT. */
export async function resolveCallCourse(
  client: SupabaseClient,
  studentId: string,
  choice: { course_id?: unknown; unit_id?: unknown }
): Promise<{ courseId: string; unitId: string } | null> {
  if (typeof choice.course_id !== 'string' || !UUID.test(choice.course_id)) return null;
  if (choice.unit_id !== undefined) {
    if (typeof choice.unit_id !== 'string' || !UUID.test(choice.unit_id)) return null;
    const { error } = await client.rpc('select_course', {
      p_course: choice.course_id,
      p_unit: choice.unit_id,
    });
    if (error) return null;
    return { courseId: choice.course_id, unitId: choice.unit_id };
  }
  // Older clients omit unit_id; read their saved place instead of guessing it.
  const { data, error } = await client
    .from('enrollments')
    .select('course_id,current_unit_id')
    .eq('student_id', studentId)
    .eq('course_id', choice.course_id)
    .maybeSingle();
  return !error && data?.current_unit_id
    ? { courseId: data.course_id, unitId: data.current_unit_id }
    : null;
}
