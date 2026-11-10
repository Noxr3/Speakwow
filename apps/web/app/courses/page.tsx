import { CoursePicker } from '@/components/app/course-picker';
import { PageShell } from '@/components/app/page-shell';
import { homeCourses } from '@/lib/home-courses';

export const metadata = { title: 'Courses · Speakwow' };

export default async function CoursesPage() {
  const library = await homeCourses().catch(() => ({
    courses: [],
    selectedId: null,
    configured: true,
    error: 'Courses could not be loaded. Refresh to try again.',
  }));
  return (
    <PageShell title="Courses">
      <CoursePicker library={library} />
    </PageShell>
  );
}
