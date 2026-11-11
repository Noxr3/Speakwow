import 'server-only';
import { personalizeCourses } from '@/lib/course-library';
import { publicCourses } from '@/lib/public-courses';
import type { HomeLibrary } from '@/lib/study-plan';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSessionUser } from '@/lib/supabase/server';

async function personalProgress() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { enrollments: [], progress: [] };
  const [enrollments, progress] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id,current_unit_id,status,updated_at')
      .eq('student_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('unit_progress')
      .select('unit_id,status,mastery,session_progress')
      .eq('student_id', user.id),
  ]);
  if (enrollments.error || progress.error)
    throw new Error('Your progress could not be loaded. Please try again.');
  return { enrollments: enrollments.data ?? [], progress: progress.data ?? [] };
}

export async function homeCourses({ selectedOnly = false } = {}): Promise<HomeLibrary> {
  if (!isSupabaseConfigured()) return { courses: [], selectedId: null, configured: false };
  // A cold catalog refresh must not hold up authentication or private reads.
  const [catalog, personal] = await Promise.all([publicCourses(), personalProgress()]);
  return personalizeCourses(catalog, personal.enrollments, personal.progress, selectedOnly);
}
