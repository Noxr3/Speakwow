import Link from 'next/link';
import { CoursePicker } from '@/components/app/course-picker';
import { PageShell } from '@/components/app/page-shell';
import { findCefrLevel, findCourseCategory } from '@/lib/course-categories';
import { homeCourses } from '@/lib/home-courses';

export const metadata = { title: 'Courses · Speakwow' };

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string | string[];
    level?: string | string[];
    grade?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const category = findCourseCategory(params.category);
  const level = category?.id === 'school-english' ? null : findCefrLevel(params.level);
  const grade =
    category?.id === 'school-english' &&
    typeof params.grade === 'string' &&
    /^(?:[1-9]|1[0-2])$/.test(params.grade)
      ? params.grade
      : null;
  const library = await homeCourses().catch(() => ({
    courses: [],
    selectedId: null,
    configured: true,
    error: 'Courses could not be loaded. Refresh to try again.',
  }));
  return (
    <PageShell
      title={category?.title ?? 'Courses'}
      subtitle={category?.description}
      breadcrumb={
        category ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-xs text-white/60">
            <Link href="/courses" className="inline-flex min-h-11 items-center hover:text-white">
              ← All categories
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{category.title}</span>
          </nav>
        ) : undefined
      }
    >
      <CoursePicker
        key={category?.id ?? 'all'}
        library={library}
        categoryId={category?.id ?? null}
        level={level?.id ?? null}
        grade={grade}
      />
    </PageShell>
  );
}
