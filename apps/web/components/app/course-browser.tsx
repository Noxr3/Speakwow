'use client';

import { useSearchParams } from 'next/navigation';
import { CourseFilterLink } from '@/components/app/course-filter-link';
import { CoursePicker } from '@/components/app/course-picker';
import { PageShell } from '@/components/app/page-shell';
import { findCefrLevel, findCourseCategory } from '@/lib/course-categories';
import type { HomeLibrary } from '@/lib/study-plan';

export function CourseBrowser({ library }: { library: HomeLibrary }) {
  const params = useSearchParams();
  const category = findCourseCategory(params.get('category') ?? undefined);
  const level =
    category?.id === 'school-english' ? null : findCefrLevel(params.get('level') ?? undefined);
  const rawGrade = params.get('grade');
  const grade =
    category?.id === 'school-english' && rawGrade && /^(?:[1-9]|1[0-2])$/.test(rawGrade)
      ? rawGrade
      : null;
  return (
    <PageShell
      wide
      title={category?.title ?? 'Courses'}
      subtitle={category?.description ?? 'Find the right course for your next step.'}
      breadcrumb={
        category ? (
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm"
          >
            <CourseFilterLink
              href="/courses"
              className="inline-flex min-h-11 items-center hover:text-white"
            >
              ← All categories
            </CourseFilterLink>
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
