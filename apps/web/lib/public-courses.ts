import { unstable_cache } from 'next/cache';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { OFFERED_SUBJECTS } from '@/lib/course-catalog';
import { type CatalogCourse, publicCourse } from '@/lib/course-library';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

// Migration 0008 makes both tables public. Use ONLY the anonymous client here:
// no request cookies, user JWT, service key, enrollments or progress in this cache.
export const publicCourses = unstable_cache(
  async () => {
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client
      .from('courses')
      .select(
        'id,slug,grade,title,description,units:course_units(id,title,position,sessions:content->sessions,goals)'
      )
      .in('subject', OFFERED_SUBJECTS)
      .order('title')
      .limit(100);
    if (error) throw new Error('Courses could not be loaded. Please try again.');
    return (data as unknown as CatalogCourse[]).map(publicCourse);
  },
  ['public-course-navigation-v1', SUPABASE_URL ?? 'unconfigured'],
  { revalidate: 60, tags: ['public-courses'] }
);
