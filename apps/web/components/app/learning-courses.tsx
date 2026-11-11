import Link from 'next/link';
import { GlassPanel } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import type { HomeLibrary } from '@/lib/study-plan';

const STATUS_LABEL: Record<string, string> = {
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

export async function LearningCourses({
  library,
  setCurrentUnit,
}: {
  library: Promise<HomeLibrary>;
  setCurrentUnit: (form: FormData) => Promise<void>;
}) {
  const data = await library;
  const course = data.courses.find((c) => c.id === data.selectedId);
  const active = course ? { course_id: course.id, current_unit_id: course.currentUnitId } : null;
  const units = course?.units ?? [];
  const current = units.find((u) => u.id === course?.currentUnitId);
  const mastered = units.filter((u) => u.progress?.status === 'mastered').length;

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
                  const progress = u.progress;
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
                          ? `${STATUS_LABEL[progress.status ?? ''] ?? progress.status} · ${Math.round(Number(progress.mastery) * 100)}%`
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
