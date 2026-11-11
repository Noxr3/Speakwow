'use client';

import { useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Globe2,
  GraduationCap,
  LoaderCircle,
  Search,
} from 'lucide-react';
import { chooseCourse } from '@/app/courses/actions';
import { CourseFilterLink as Link } from '@/components/app/course-filter-link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CEFR_LEVELS,
  CEFR_SOURCE,
  COURSE_CATEGORIES,
  type CefrLevel,
  type CourseCategoryId,
  categoryHref,
  courseCategory,
  courseLevelHref,
  courseLevelLabel,
  matchesCourseLevel,
} from '@/lib/course-categories';
import { ensureGuestSession } from '@/lib/guest';
import {
  type HomeCourse,
  type HomeLibrary,
  completedSessions,
  coursePosition,
} from '@/lib/study-plan';
import { createClient } from '@/lib/supabase/client';

export function CoursePicker({
  library,
  categoryId,
  level,
  grade,
}: {
  library: HomeLibrary;
  categoryId: CourseCategoryId | null;
  level: CefrLevel | null;
  grade: string | null;
}) {
  const [query, setQuery] = useState('');
  const [outline, setOutline] = useState<HomeCourse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const category = COURSE_CATEGORIES.find((item) => item.id === categoryId);
  const search = query.trim().toLowerCase();
  const filtered = library.courses.filter((course) => {
    const group = COURSE_CATEGORIES.find((item) => item.id === courseCategory(course));
    return (
      (!categoryId || group?.id === categoryId) &&
      matchesCourseLevel(course, level) &&
      (!grade || course.grade === grade) &&
      `${course.title} ${course.description ?? ''} ${group?.title ?? ''} ${course.grade ? `Grade ${course.grade}` : ''}`
        .toLowerCase()
        .includes(search)
    );
  });
  const browsingCategories = !categoryId && !search && !level;
  const categories = COURSE_CATEGORIES.map((item) => ({
    ...item,
    courses: library.courses.filter((course) => courseCategory(course) === item.id),
  })).filter((item) => item.id !== 'more-english' || item.courses.length > 0);
  const selectCourse = async (courseId: string, unitId?: string) => {
    if (busy) return;
    if (!unitId && courseId === library.selectedId) {
      router.push('/');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const client = createClient();
      await ensureGuestSession(client, { verifyExisting: false });
      let result = await chooseCourse(courseId, unitId);
      if (result.code === 'auth_required') {
        await ensureGuestSession(client);
        result = await chooseCourse(courseId, unitId);
      }
      if (result.error) {
        setError(result.error);
        return;
      }
    } catch (error) {
      unstable_rethrow(error);
      setError('Your course could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {busy && (
        <div
          role="status"
          className="bg-popover text-foreground fixed inset-x-5 bottom-6 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm shadow-xl"
        >
          <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />
          Opening your course…
        </div>
      )}
      <div className="relative max-w-xl">
        <Search
          size={20}
          className="text-muted-foreground pointer-events-none absolute top-3.5 left-4"
        />
        <input
          aria-label={category ? `Search ${category.title}` : 'Search all courses'}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={category ? 'Find a course' : 'Search all courses'}
          className="field pl-12"
        />
      </div>
      {categoryId === 'school-english' && (
        <nav aria-label="School grade" className="flex flex-wrap gap-2">
          {[
            null,
            ...Array.from(
              new Set(
                library.courses
                  .filter((course) => courseCategory(course) === categoryId)
                  .map((course) => course.grade)
                  .filter((value): value is string => Boolean(value))
              )
            ).sort((a, b) => Number(a) - Number(b)),
          ].map((value) => (
            <Link
              key={value ?? 'all'}
              href={`${categoryHref(categoryId)}${value ? `&grade=${encodeURIComponent(value)}` : ''}`}
              scroll={false}
              aria-current={grade === value ? 'page' : undefined}
              className="filter-chip"
            >
              {value ? `Grade ${value}` : 'All grades'}
            </Link>
          ))}
        </nav>
      )}
      {!browsingCategories && categoryId !== 'school-english' && (
        <div className="space-y-3">
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>CEFR level</span>
            <a href={CEFR_SOURCE} target="_blank" rel="noreferrer" className="hover:text-white">
              About the levels ↗
            </a>
          </div>
          <nav aria-label="Course difficulty" className="flex flex-wrap gap-2">
            {[null, ...CEFR_LEVELS.map((item) => item.id)].map((value) => (
              <Link
                key={value ?? 'all'}
                href={courseLevelHref(categoryId, value)}
                scroll={false}
                aria-current={level === value ? 'page' : undefined}
                className="filter-chip"
              >
                {value ?? 'All levels'}
              </Link>
            ))}
          </nav>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {level
              ? CEFR_LEVELS.find((item) => item.id === level)?.description
              : 'A range shows where a course starts and the skills it builds toward.'}
          </p>
        </div>
      )}
      {(library.error || error) && (
        <p role="alert" className="text-sm">
          {library.error || error}
        </p>
      )}
      {browsingCategories && !library.error && (
        <nav aria-label="Course categories" className="grid gap-6 md:grid-cols-3">
          {categories.map((item) => (
            <Link key={item.id} href={categoryHref(item.id)} className="category-tile group">
              <span className="category-icon" aria-hidden="true">
                {item.id === 'school-english' ? (
                  <GraduationCap size={24} />
                ) : item.id === 'ielts-toefl' ? (
                  <Globe2 size={24} />
                ) : (
                  <BookOpen size={24} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
                  {item.description}
                </p>
                <p className="text-muted-foreground mt-5 text-sm">
                  {item.courses.length ? `${item.courses.length} courses` : 'No courses yet'}
                </p>
              </div>
              <ChevronRight
                size={18}
                className="text-muted-foreground mt-auto self-end group-hover:text-white"
                aria-hidden="true"
              />
            </Link>
          ))}
        </nav>
      )}
      {!browsingCategories && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => {
            const position = coursePosition(course);
            const active = course.id === library.selectedId;
            return (
              <article key={course.id} className="course-tile" data-active={active}>
                <button
                  disabled={busy || !course.units.length}
                  aria-pressed={active}
                  onClick={() => selectCourse(course.id)}
                  className="course-select"
                >
                  <span className="min-w-0 flex-1">
                    {!categoryId && (
                      <span className="text-muted-foreground mb-2 block text-sm">
                        {
                          COURSE_CATEGORIES.find((item) => item.id === courseCategory(course))
                            ?.title
                        }
                      </span>
                    )}
                    <span className="block text-xl leading-snug font-semibold">{course.title}</span>
                    <span className="level-badge mt-4">{courseLevelLabel(course)}</span>
                    <span className="text-muted-foreground mt-4 block text-sm">
                      {course.started
                        ? `${position.completed} of ${position.total} sessions`
                        : `${course.units.length} lessons`}
                    </span>
                    {course.started && (
                      <progress
                        className="study-progress mt-3 w-full"
                        max={position.total || 1}
                        value={position.completed}
                        aria-label={`${course.title} progress`}
                      />
                    )}
                  </span>
                  {active ? (
                    <Check size={17} className="text-primary mt-1 shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground mt-1 shrink-0" />
                  )}
                </button>
                <button
                  onClick={() => setOutline(course)}
                  aria-label={`View plan for ${course.title}`}
                  className="text-primary min-h-12 w-full border-t border-white/10 px-6 text-left text-sm hover:bg-white/5"
                >
                  View plan
                </button>
              </article>
            );
          })}
        </div>
      )}
      {!browsingCategories && !library.error && !filtered.length && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {search
            ? 'No matching courses. Try a different search.'
            : level
              ? `No ${level} courses in this category yet.`
              : 'No courses in this category yet.'}
        </p>
      )}
      <Dialog
        open={Boolean(outline)}
        onOpenChange={(open) => {
          if (!open) setOutline(null);
        }}
      >
        {outline && (
          <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{outline.title}</DialogTitle>
              <p className="text-muted-foreground mt-2 text-sm font-normal">
                {courseLevelLabel(outline)}
              </p>
            </DialogHeader>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              {outline.description}
            </p>
            {error && (
              <p role="alert" className="text-sm">
                {error}
              </p>
            )}
            <ol className="divide-border mt-3 divide-y">
              {outline.units.map((unit) => {
                const done = completedSessions(unit.sessions, unit.progress);
                return (
                  <li key={unit.id} className="py-3">
                    <details open={unit.id === outline.currentUnitId}>
                      <summary className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                        <span className="text-muted-foreground w-6 tabular-nums">
                          {done === unit.sessions.length ? <Check size={16} /> : unit.position}
                        </span>
                        <span className="flex-1 font-medium">{unit.title}</span>
                        <span className="text-muted-foreground text-sm">
                          {done}/{unit.sessions.length}
                        </span>
                        <ChevronDown size={14} />
                      </summary>
                      <ul className="ml-9 space-y-3 py-3 text-sm">
                        {unit.sessions.map((session) => (
                          <li key={session.id} className="flex items-center justify-between gap-4">
                            <span>{session.title}</span>
                            <span className="text-muted-foreground text-sm">
                              {unit.progress?.status === 'mastered' ||
                              unit.progress?.session_progress?.[session.id]?.status === 'mastered'
                                ? 'Completed'
                                : session.kind === 'exam'
                                  ? 'Assessment'
                                  : `${session.minutes ?? 10} min`}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {unit.id !== outline.currentUnitId && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            await selectCourse(outline.id, unit.id);
                          }}
                          className="text-primary ml-9 min-h-11 text-sm disabled:opacity-50"
                        >
                          Study this lesson
                        </button>
                      )}
                    </details>
                  </li>
                );
              })}
            </ol>
            <Button
              disabled={busy}
              onClick={() => selectCourse(outline.id)}
              className="mt-6 w-full"
            >
              {busy ? 'One moment…' : 'Study this course'}
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
