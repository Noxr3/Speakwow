'use server';

import { redirect } from 'next/navigation';
import { enroll } from '@/app/profile/actions';

/** Start (or go back to) a course, then straight to the call screen, where
 * "Lesson" is now the default. */
export async function startCourse(form: FormData) {
  await enroll(form);
  redirect('/');
}
