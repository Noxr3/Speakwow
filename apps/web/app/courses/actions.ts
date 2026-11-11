'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { enroll } from '@/app/profile/actions';
import { getSessionUser } from '@/lib/supabase/server';

export async function startCourse(form: FormData) {
  await enroll(form);
  redirect('/');
}

/** Redirect as part of the action: no catalog rerender or separate client push. */
export async function chooseCourse(courseId: string, unitId?: string) {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user)
    return { code: 'auth_required', error: 'Sign in to save your course and progress.' };
  const { error } = await supabase.rpc('select_course', {
    p_course: courseId,
    p_unit: unitId ?? null,
  });
  if (error) return { error: 'Your course could not be saved. Please try again.' };
  revalidatePath('/');
  revalidatePath('/profile');
  revalidatePath('/courses');
  redirect('/');
}
