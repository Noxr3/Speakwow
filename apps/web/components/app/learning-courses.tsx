import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GlassPanel } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';

const STATUS_LABEL: Record<string, string> = {
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

export async function LearningCourses({
  supabase,
  userId,
  setCurrentUnit,
}: {
  supabase: SupabaseClient;
  userId: string;
  setCurrentUnit: (form: FormData) => Promise<void>;
}) {
  const enrollment = await supabase
    .from('enrollments')
    .select('course_id, current_unit_id, course:courses(title)')
    .eq('student_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (enrollment.error) throw new Error('Could not load your course. Please try again.');
  const active = enrollment.data;
  const course = active?.course as unknown as { title: string } | null;
  const unitsResult = active
    ? await supabase
        .from('course_units')
        .select('id, position, title, topic')
        .eq('course_id', active.course_id)
        .order('position')
    : null;
  if (unitsResult?.error) throw new Error('Could not load the current course. Please try again.');
  const units = unitsResult?.data ?? [];
  const progressResult = units.length
    ? await supabase
        .from('unit_progress')
        .select('unit_id, status, mastery')
        .eq('student_id', userId)
        .in(
          'unit_id',
          units.map((u) => u.id)
        )
    : null;
  if (progressResult?.error) throw new Error('Could not load course progress. Please try again.');
  const byUnit = new Map((progressResult?.data ?? []).map((p) => [p.unit_id, p]));
  const current = units.find((u) => u.id === active?.current_unit_id);
  const mastered = (progressResult?.data ?? []).filter((p) => p.status === 'mastered').length;

  return (
    <div className="space-y-8">
      {active && course && (
        <div id="current-course" className="scroll-mt-24">
          <GlassPanel title="Continue learning">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 space-y-2">
                <h3 className="text-foreground text-base font-medium">{course.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {current ? `Unit ${current.position} · ${current.title}` : 'Choose a unit below'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {mastered} of {units.length} units mastered
                </p>
              </div>
              <Button asChild className="shrink-0 self-start rounded-full px-5 sm:self-auto">
                <Link href="/">Continue lesson</Link>
              </Button>
            </div>
            <details className="group border-t border-white/10 pt-4">
              <summary className="text-primary flex min-h-11 cursor-pointer items-center text-sm">
                View units & progress
              </summary>
              <ol className="mt-4 space-y-2">
                {units.map((u) => {
                  const progress = byUnit.get(u.id);
                  const isCurrent = u.id === active.current_unit_id;
                  return (
                    <li
                      key={u.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4 text-sm ${isCurrent ? 'border border-white/25 bg-white/[0.08]' : 'bg-white/[0.03]'}`}
                    >
                      <span className="label-caption text-muted-foreground text-xs">
                        {u.position.toString().padStart(2, '0')}
                      </span>
                      <span className="text-foreground min-w-0 flex-1 break-words">{u.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {progress
                          ? `${STATUS_LABEL[progress.status] ?? progress.status} · ${Math.round(Number(progress.mastery) * 100)}%`
                          : isCurrent
                            ? 'Up next'
                            : ''}
                      </span>
                      {!isCurrent && (
                        <form action={setCurrentUnit}>
                          <input type="hidden" name="course_id" value={active.course_id} />
                          <input type="hidden" name="unit_id" value={u.id} />
                          <button
                            type="submit"
                            className="text-primary inline-flex min-h-11 items-center px-2 text-sm underline"
                          >
                            Study
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
            <Link
              href="/courses"
              className="text-primary inline-flex min-h-11 items-center text-sm"
            >
              Browse courses
            </Link>
          </GlassPanel>
        </div>
      )}
      {!active && (
        <GlassPanel title="Your courses">
          <p className="text-muted-foreground text-base">
            Choose a course to begin learning with your teacher.
          </p>
          <Button asChild>
            <Link href="/courses">Browse courses</Link>
          </Button>
        </GlassPanel>
      )}
    </div>
  );
}
