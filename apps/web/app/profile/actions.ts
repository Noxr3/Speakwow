'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';

/** Every action acts as the signed-in student; row-level security does the rest. */
async function student() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) throw new Error('Please sign in.');
  return { supabase, user };
}

const GRADES = new Set(['', '7', '8', '9', 'other']);

export async function updateProfile(form: FormData) {
  const { supabase, user } = await student();
  const grade = String(form.get('grade') ?? '');
  await supabase
    .from('profiles')
    .update({
      display_name:
        String(form.get('display_name') ?? '')
          .trim()
          .slice(0, 60) || null,
      grade: GRADES.has(grade) && grade ? grade : null,
      learning_goal:
        String(form.get('learning_goal') ?? '')
          .trim()
          .slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
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

export async function forgetFact(form: FormData) {
  const { supabase } = await student();
  await supabase
    .from('student_facts')
    .delete()
    .eq('id', String(form.get('id')));
  revalidatePath('/profile');
}

export async function forgetWeakness(form: FormData) {
  const { supabase } = await student();
  await supabase
    .from('weaknesses')
    .delete()
    .eq('id', String(form.get('id')));
  revalidatePath('/profile');
}
