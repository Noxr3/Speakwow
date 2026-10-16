import { redirect } from 'next/navigation';
import { GlassPanel, PageShell } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { memorySummary } from '@/lib/memory-summary';
import { getSessionUser } from '@/lib/supabase/server';
import { enroll, forgetMemory, forgetWeakness, saveMemory, setCurrentUnit } from './actions';

export const metadata = { title: 'Learning record · Speakwow' };

const STATUS_LABEL: Record<string, string> = {
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

const field = 'field';

/** 学习档案: who the student is, where they are in their course, and what the
 * teacher remembers — every remembered thing can be erased here. */
export default async function ProfilePage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) redirect('/login');

  const [enrollments, courses, memories, weaknesses, sessions] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id, current_unit_id, status, updated_at')
      .eq('student_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase.from('courses').select('id, title').order('slug'),
    supabase
      .from('user_memories')
      .select('id, content, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('weaknesses')
      .select('id, item, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('sessions')
      .select('id, persona_id, mode, started_at, summary')
      .not('summary', 'is', null)
      .order('started_at', { ascending: false })
      .limit(10),
  ]);

  const active = enrollments.data?.find((e) => e.status === 'active') ?? null;
  const course = active ? courses.data?.find((c) => c.id === active.course_id) : null;
  const units = active
    ? ((
        await supabase
          .from('course_units')
          .select('id, position, title, theme, topic')
          .eq('course_id', active.course_id)
          .order('position')
      ).data ?? [])
    : [];
  const progress = units.length
    ? ((
        await supabase
          .from('unit_progress')
          .select('unit_id, status, mastery')
          .in(
            'unit_id',
            units.map((u) => u.id)
          )
      ).data ?? [])
    : [];
  const byUnit = new Map(progress.map((p) => [p.unit_id, p]));
  if (memories.error) throw new Error('Could not load your memories. Please try again.');
  const summary = memorySummary(memories.data ?? []);

  return (
    <PageShell title="Learning record">
      <GlassPanel title="About you">
        <p className="text-foreground text-sm leading-relaxed break-words">
          {summary ||
            'Your teacher is still getting to know you. As you talk, a picture of your interests, preferences, and experiences will take shape here.'}
        </p>
        <details className="border-t border-white/10 pt-4">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            Manage memory
          </summary>
          <div className="mt-4 space-y-5">
            {memories.data?.length ? (
              <ul className="space-y-4">
                {memories.data.map((memory) => (
                  <li key={memory.id} className="space-y-2">
                    <form action={saveMemory} className="grid gap-2">
                      <input type="hidden" name="id" value={memory.id} />
                      <input type="hidden" name="updated_at" value={memory.updated_at} />
                      <textarea
                        name="content"
                        aria-label="Remembered information"
                        defaultValue={memory.content}
                        maxLength={800}
                        required
                        rows={2}
                        className={field}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="justify-self-start"
                      >
                        Save changes
                      </Button>
                    </form>
                    <form action={forgetMemory}>
                      <input type="hidden" name="id" value={memory.id} />
                      <input type="hidden" name="updated_at" value={memory.updated_at} />
                      <button type="submit" className="text-muted-foreground text-xs underline">
                        Forget
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nothing yet. Tell your teacher a little about yourself when you next talk.
              </p>
            )}
            <form action={saveMemory} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Something you would like your teacher to remember
                </span>
                <textarea name="content" maxLength={800} required rows={2} className={field} />
              </label>
              <Button type="submit" className="justify-self-start rounded-full px-5">
                Remember
              </Button>
            </form>
          </div>
        </details>
      </GlassPanel>

      <GlassPanel title="Course">
        {course ? (
          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">{course.title}</p>
            <ol className="space-y-1.5">
              {units.map((u) => {
                const prog = byUnit.get(u.id);
                const current = u.id === active!.current_unit_id;
                return (
                  <li
                    key={u.id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm ${
                      current
                        ? 'border border-white/30 bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]'
                        : 'bg-white/[0.03]'
                    }`}
                  >
                    <span className="label-mono w-16 shrink-0 text-white/45">
                      Unit {u.position}
                    </span>
                    <span className="text-foreground min-w-0 flex-1 truncate">
                      {u.title}
                      {u.topic && (
                        <span className="text-muted-foreground ml-2 text-xs">{u.topic}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground w-24 text-right text-xs">
                      {prog
                        ? `${STATUS_LABEL[prog.status] ?? prog.status} · ${Math.round(Number(prog.mastery) * 100)}%`
                        : current
                          ? 'Up next'
                          : ''}
                    </span>
                    {!current && (
                      <form action={setCurrentUnit}>
                        <input type="hidden" name="course_id" value={active!.course_id} />
                        <input type="hidden" name="unit_id" value={u.id} />
                        <button type="submit" className="text-primary text-xs underline">
                          Study
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Pick your textbook and your teacher will teach it unit by unit, remember your progress.
          </p>
        )}
        {courses.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {courses.data
              .filter((c) => c.id !== course?.id)
              .map((c) => (
                <form key={c.id} action={enroll}>
                  <input type="hidden" name="course_id" value={c.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {course ? 'Switch to ' : 'Start '}
                    {c.title}
                  </Button>
                </form>
              ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            No courses on this server yet. Import one with <code>pnpm course:import</code>.
          </p>
        )}
      </GlassPanel>

      {weaknesses.data?.length ? (
        <GlassPanel title="What you are practising">
          <ul className="space-y-1.5">
            {weaknesses.data.map((w) => (
              <li key={w.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{w.item}</span>
                <form action={forgetWeakness}>
                  <input type="hidden" name="id" value={w.id} />
                  <button type="submit" className="text-muted-foreground text-xs underline">
                    Forget
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}

      <GlassPanel title="Recent lessons">
        {sessions.data?.length ? (
          <ul className="space-y-3">
            {sessions.data.map((s) => (
              <li key={s.id} className="text-sm">
                <p className="text-muted-foreground text-xs">
                  {s.started_at ? new Date(s.started_at).toLocaleDateString() : ''} · {s.persona_id}{' '}
                  · {s.mode === 'course' ? 'Lesson' : 'Free talk'}
                </p>
                <p className="text-foreground">{s.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Your lessons will show up here.</p>
        )}
      </GlassPanel>
    </PageShell>
  );
}
