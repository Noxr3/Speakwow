import { CourseBrowser } from '@/components/app/course-browser';
import { homeCourses } from '@/lib/home-courses';

export const metadata = { title: 'Courses · Speakwow' };
export default async function CoursesPage() {
  const library = await homeCourses().catch(() => ({
    courses: [],
    selectedId: null,
    configured: true,
    error: 'Courses could not be loaded. Refresh to try again.',
  }));
  return <CourseBrowser library={library} />;
}
