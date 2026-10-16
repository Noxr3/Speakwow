import { redirect } from 'next/navigation';
import { type CatalogCourse, CourseCatalog } from '@/components/app/course-catalog';
import { PageShell } from '@/components/app/page-shell';
import {
  COURSES_PER_PAGE,
  type CatalogParams,
  OFFERED_SUBJECTS,
  catalogHref,
  catalogParams,
  catalogPattern,
} from '@/lib/course-catalog';
import { getSessionUser } from '@/lib/supabase/server';
import { startCourse } from './actions';

export const metadata = { title: 'Courses · Speakwow' };

/** 选课: the course catalog, open to visitors (migration 0008). Starting a
 * course goes straight back to the call screen with Lesson selected. */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogParams>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!supabase) {
    return (
      <PageShell title="Courses">
        <p className="text-muted-foreground text-sm">Courses aren&apos;t set up on this server.</p>
      </PageShell>
    );
  }
  const { q, page, from, to } = catalogParams(params);
  let query = supabase
    .from('courses')
    .select('id, title, description, subject, publisher, units:course_units(count)', {
      count: 'exact',
    })
    .in('subject', OFFERED_SUBJECTS);
  if (q) query = query.ilike('search_text', catalogPattern(q));
  const [catalog, enrolment] = await Promise.all([
    query.order('title').order('id').range(from, to),
    user
      ? supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (catalog.error) throw new Error('Could not load courses. Please try again.');
  const total = catalog.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / COURSES_PER_PAGE));
  if (page > pages) redirect(catalogHref(q, pages, '/courses'));

  return (
    <PageShell
      title="Courses"
      subtitle="Pick a course and your teacher follows it unit by unit, with a little chat first. Free talk is always there too."
    >
      <CourseCatalog
        courses={(catalog.data ?? []) as CatalogCourse[]}
        total={total}
        query={q}
        page={page}
        activeCourseId={(enrolment.data as { course_id: string } | null)?.course_id}
        enroll={user ? startCourse : undefined}
        basePath="/courses"
        activeHref="/"
        signInHref="/login?next=/courses"
      />
    </PageShell>
  );
}
