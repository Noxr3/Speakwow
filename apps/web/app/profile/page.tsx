import { redirect } from 'next/navigation';
import { LearningCourses } from '@/components/app/learning-courses';
import { GlassPanel, PageShell } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import type { CatalogParams } from '@/lib/course-catalog';
import { memorySummary } from '@/lib/memory-summary';
import { getSessionUser } from '@/lib/supabase/server';
import { enroll, forgetMemory, forgetWeakness, saveMemory, setCurrentUnit } from './actions';

export const metadata = { title: 'Learning record · Speakwow' };

const field = 'field';

/** 学习档案: who the student is, where they are in their course, and what the
 * teacher remembers — every remembered thing can be erased here. */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<CatalogParams>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) redirect('/login');

  const [memories, weaknesses, sessions] = await Promise.all([
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

  if (memories.error) throw new Error('Could not load your memories. Please try again.');
  const summary = memorySummary(memories.data ?? []);

  return (
    <PageShell title="Learning record" wide>
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

      <LearningCourses
        supabase={supabase}
        userId={user.id}
        params={params}
        enroll={enroll}
        setCurrentUnit={setCurrentUnit}
      />

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
