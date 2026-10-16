import Link from 'next/link';
import { GlassPanel, PageShell } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { READY_SUBJECTS, gradeLabel, subjectLabel } from '@/lib/courses';
import { getSessionUser } from '@/lib/supabase/server';
import { startCourse } from './actions';

export const metadata = { title: 'Courses · Speakwow' };

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  subject: string | null;
  grade: string | null;
  description: string | null;
}

interface UnitRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
}

/** 选课: every course the teacher can teach unit by unit, open to visitors. */
export default async function CoursesPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) {
    return (
      <PageShell title="Courses">
        <p className="text-muted-foreground text-sm">Courses aren&apos;t set up on this server.</p>
      </PageShell>
    );
  }

  const [courses, units, enrolment] = await Promise.all([
    supabase.from('courses').select('id, slug, title, subject, grade, description').order('slug'),
    supabase.from('course_units').select('id, course_id, position, title').order('position'),
    user
      ? supabase
          .from('enrollments')
          .select('course_id, current_unit_id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const unitsByCourse = new Map<string, UnitRow[]>();
  for (const unit of (units.data ?? []) as UnitRow[]) {
    unitsByCourse.set(unit.course_id, [...(unitsByCourse.get(unit.course_id) ?? []), unit]);
  }
  const active = enrolment.data as { course_id: string; current_unit_id: string } | null;

  const bySubject = new Map<string, CourseRow[]>();
  // Language courses only, for now: the teacher is a language teacher.
  const offered = ((courses.data ?? []) as CourseRow[]).filter((c) =>
    READY_SUBJECTS.has(c.subject ?? '')
  );
  for (const course of offered) {
    const key = course.subject ?? 'other';
    bySubject.set(key, [...(bySubject.get(key) ?? []), course]);
  }
  // Subjects the teacher can teach first.
  const subjects = [...bySubject.keys()].sort(
    (a, b) => Number(READY_SUBJECTS.has(b)) - Number(READY_SUBJECTS.has(a)) || a.localeCompare(b)
  );

  return (
    <PageShell
      title="Courses"
      subtitle="Pick a course and your teacher follows it unit by unit, with a little chat first. Free talk is always there too."
    >
      {subjects.length === 0 && <p className="text-muted-foreground text-sm">No courses yet.</p>}
      {subjects.map((subject) => (
        <GlassPanel key={subject} title={subjectLabel(subject)}>
          <ul className="space-y-3">
            {bySubject.get(subject)!.map((course) => {
              const list = unitsByCourse.get(course.id) ?? [];
              const current = active?.course_id === course.id;
              const currentUnit = current
                ? list.find((u) => u.id === active!.current_unit_id)
                : undefined;
              const meta = [gradeLabel(course.grade), `${list.length} units`]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={course.id}
                  data-course={course.slug}
                  className={`space-y-3 rounded-2xl px-4 py-4 ${
                    current
                      ? 'border border-white/30 bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]'
                      : 'bg-white/[0.03]'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-foreground font-medium">{course.title}</p>
                    <p className="label-mono text-white/45">
                      {meta}
                      {current && currentUnit && ` · now on unit ${currentUnit.position}`}
                    </p>
                    {course.description && (
                      <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {list.length > 0 && (
                    <details className="group text-sm">
                      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
                        Units
                      </summary>
                      <ol className="mt-2 space-y-1">
                        {list.map((u) => (
                          <li key={u.id} className="flex gap-3">
                            <span className="label-mono w-14 shrink-0 text-white/45">
                              Unit {u.position}
                            </span>
                            <span className="text-foreground/90 min-w-0 truncate">{u.title}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  {current ? (
                    <Button asChild className="rounded-full px-5">
                      <Link href="/">Continue</Link>
                    </Button>
                  ) : user ? (
                    <form action={startCourse}>
                      <input type="hidden" name="course_id" value={course.id} />
                      <Button type="submit" className="rounded-full px-5">
                        Start this course
                      </Button>
                    </form>
                  ) : (
                    <Button asChild variant="outline" className="rounded-full px-5">
                      <Link href="/login?next=/courses">Sign in to start</Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      ))}
    </PageShell>
  );
}
