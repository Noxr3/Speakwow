import { headers } from 'next/headers';
import { personaSummaries } from '@speakwow/shared';
import { App, type CourseSpot } from '@/components/app/app';
import { getSessionUser } from '@/lib/supabase/server';
import { getAppConfig } from '@/lib/utils';

/** Where a signed-in student is in their course, for the "Lesson" choice. */
async function currentCourseSpot(): Promise<CourseSpot | null> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return null;
  const { data } = await supabase
    .from('enrollments')
    .select('course:courses(title), unit:course_units(position, title)')
    .eq('student_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const course = data?.course as unknown as { title: string } | null;
  const unit = data?.unit as unknown as { position: number; title: string } | null;
  return course && unit
    ? { title: course.title, unitPosition: unit.position, unitTitle: unit.title }
    : null;
}

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <App appConfig={appConfig} personas={personaSummaries()} course={await currentCourseSpot()} />
  );
}
