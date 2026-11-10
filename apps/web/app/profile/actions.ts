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
  const { supabase } = await student();
  const { error } = await supabase.rpc('select_course', {
    p_course: String(form.get('course_id') ?? ''),
    p_unit: null,
  });
  if (error) throw new Error('Your course could not be saved. Please try again.');
  revalidatePath('/profile');
  revalidatePath('/');
  revalidatePath('/courses');
}

export async function setCurrentUnit(form: FormData) {
  const { supabase } = await student();
  const { error } = await supabase.rpc('select_course', {
    p_course: String(form.get('course_id') ?? ''),
    p_unit: String(form.get('unit_id') ?? ''),
  });
  if (error) throw new Error('Your lesson could not be saved. Please try again.');
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
