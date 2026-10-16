'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';

/** Every action acts as the signed-in student; row-level security does the rest. */
async function student() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) throw new Error('Please sign in.');
  return { supabase, user };
}

/** User edits use the version shown on screen, never overwrite a newer memory. */
export async function saveMemory(form: FormData) {
  const { supabase, user } = await student();
  const content = String(form.get('content') ?? '').trim();
  if (!content || content.length > 800) throw new Error('Please enter 1–800 characters.');
  const id = String(form.get('id') ?? '');
  const result = id
    ? await supabase
        .from('user_memories')
        .update({ content, source_session_id: null })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('updated_at', String(form.get('updated_at') ?? ''))
        .is('deleted_at', null)
        .select('id')
    : await supabase
        .from('user_memories')
        .insert({
          user_id: user.id,
          key: `note-${crypto.randomUUID()}`,
          content,
        })
        .select('id');
  if (result.error || !result.data?.length) {
    throw new Error('Memory could not be saved. Refresh the page and try again.');
  }
  revalidatePath('/profile');
}

export async function forgetMemory(form: FormData) {
  const { supabase, user } = await student();
  const { data, error } = await supabase
    .from('user_memories')
    .update({ content: '', deleted_at: new Date().toISOString(), source_session_id: null })
    .eq('id', String(form.get('id') ?? ''))
    .eq('user_id', user.id)
    .eq('updated_at', String(form.get('updated_at') ?? ''))
    .is('deleted_at', null)
    .select('id');
  if (error || !data?.length) {
    throw new Error('Memory could not be forgotten. Refresh the page and try again.');
  }
  revalidatePath('/profile');
}

export async function enroll(form: FormData) {
  const { supabase, user } = await student();
  const courseId = String(form.get('course_id') ?? '');
  const { data: first } = await supabase
    .from('course_units')
    .select('id')
    .eq('course_id', courseId)
    .order('position')
    .limit(1)
    .maybeSingle();
  if (!first) return;
  const now = new Date().toISOString();
  // One active course at a time: pause the others, keep their progress.
  await supabase
    .from('enrollments')
    .update({ status: 'paused', updated_at: now })
    .eq('student_id', user.id)
    .eq('status', 'active')
    .neq('course_id', courseId);
  const { data: existing } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from('enrollments')
      .update({ status: 'active', updated_at: now })
      .eq('student_id', user.id)
      .eq('course_id', courseId);
  } else {
    await supabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId,
      current_unit_id: first.id,
      updated_at: now,
    });
  }
  revalidatePath('/profile');
  revalidatePath('/');
}

export async function setCurrentUnit(form: FormData) {
  const { supabase, user } = await student();
  await supabase
    .from('enrollments')
    .update({ current_unit_id: String(form.get('unit_id')), updated_at: new Date().toISOString() })
    .eq('student_id', user.id)
    .eq('course_id', String(form.get('course_id')));
  revalidatePath('/profile');
  revalidatePath('/');
}

export async function forgetWeakness(form: FormData) {
  const { supabase } = await student();
  await supabase
    .from('weaknesses')
    .delete()
    .eq('id', String(form.get('id')));
  revalidatePath('/profile');
}
