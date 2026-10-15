import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/supabase/server';
import { enroll, forgetFact, forgetWeakness, setCurrentUnit, updateProfile } from './actions';

export const metadata = { title: 'Learning record · Speakwow' };

const STATUS_LABEL: Record<string, string> = {
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-5">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const field =
  'border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm';

/** 学习档案: who the student is, where they are in their course, and what the
 * teacher remembers — every remembered thing can be erased here. */
export default async function ProfilePage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) redirect('/login');

  const [profile, enrollments, courses, facts, weaknesses, sessions] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, level, grade, learning_goal')
      .eq('id', user.id)
      .single(),
    supabase
      .from('enrollments')
      .select('course_id, current_unit_id, status, updated_at')
      .eq('student_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase.from('courses').select('id, title, grade, region').order('slug'),
    supabase
      .from('student_facts')
      .select('id, fact, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
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
  const p = profile.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-24">
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back to your teacher
        </Link>
        <h1 className="text-foreground mt-4 text-3xl font-bold">Learning record</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          学习档案 · Level {p?.level ?? 'not assessed yet'}
          {p?.level ? ' (estimated by your teacher)' : ''}
        </p>
      </div>

      <Section title="About you">
        <form action={updateProfile} className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">What should your teacher call you?</span>
            <input name="display_name" defaultValue={p?.display_name ?? ''} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Grade</span>
            <select name="grade" defaultValue={p?.grade ?? ''} className={field}>
              <option value="">—</option>
              <option value="7">Grade 7 · 初一</option>
              <option value="8">Grade 8 · 初二</option>
              <option value="9">Grade 9 · 初三</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Your goal</span>
            <input
              name="learning_goal"
              defaultValue={p?.learning_goal ?? ''}
              placeholder="e.g. speak confidently in class, do well in the 中考 speaking test"
              className={field}
            />
          </label>
          <Button type="submit" className="justify-self-start">
            Save
          </Button>
        </form>
      </Section>

      <Section title="Course">
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      current ? 'bg-primary/10 border-primary border' : 'bg-white/5'
                    }`}
                  >
                    <span className="text-muted-foreground w-14 shrink-0">Unit {u.position}</span>
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
            Pick your textbook and your teacher will teach it unit by unit, then remember how each
            goal went.
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
      </Section>

      <Section title="What your teacher remembers">
        {facts.data?.length || weaknesses.data?.length ? (
          <ul className="space-y-1.5">
            {facts.data?.map((f) => (
              <li key={f.id} className="flex items-center gap-3 text-sm">
                <span className="text-foreground flex-1">{f.fact}</span>
                <form action={forgetFact}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="text-muted-foreground text-xs underline">
                    Forget
                  </button>
                </form>
              </li>
            ))}
            {weaknesses.data?.map((w) => (
              <li key={w.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">
                  <span className="text-muted-foreground">Working on: </span>
                  {w.item}
                </span>
                <form action={forgetWeakness}>
                  <input type="hidden" name="id" value={w.id} />
                  <button type="submit" className="text-muted-foreground text-xs underline">
                    Forget
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nothing yet. After each call your teacher keeps a few notes — your goals, what you told
            them, what to practise — and you can erase any of them here.
          </p>
        )}
      </Section>

      <Section title="Recent lessons">
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
      </Section>
    </div>
  );
}
