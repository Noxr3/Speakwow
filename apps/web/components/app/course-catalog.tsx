import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COURSES_PER_PAGE, catalogHref, catalogPages } from '@/lib/course-catalog';

export interface CatalogCourse {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  publisher: string | null;
  units: { count: number }[];
}

interface CourseCatalogProps {
  courses: CatalogCourse[];
  total: number;
  query: string;
  page: number;
  activeCourseId?: string;
  /** signed in: starts the course; absent for a visitor, who gets signInHref */
  enroll?: (data: FormData) => Promise<void>;
  /** the page the catalog sits on: /profile, or /courses (open to visitors) */
  basePath?: string;
  /** where "Currently learning" leads */
  activeHref?: string;
  signInHref?: string;
}

const pageLink =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

export function CourseCatalog({
  courses,
  total,
  query,
  page,
  activeCourseId,
  enroll,
  basePath = '/profile',
  activeHref = '#current-course',
  signInHref = '/login',
}: CourseCatalogProps) {
  const pages = Math.max(1, Math.ceil(total / COURSES_PER_PAGE));
  return (
    <section id="courses" aria-labelledby="catalog-title" className="scroll-mt-24 space-y-6">
      <div className="space-y-2">
        <p className="label-mono text-primary">Explore & learn</p>
        <h2 id="catalog-title" className="text-foreground text-2xl font-medium">
          Course catalog
        </h2>
        <p className="text-muted-foreground text-sm">
          Find your next conversation, skill, or subject.
        </p>
      </div>
      <form
        action={`${basePath}#courses`}
        method="get"
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            aria-hidden="true"
            className="text-muted-foreground absolute top-3.5 left-4"
          />
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <input
            id="course-search"
            name="q"
            type="search"
            defaultValue={query}
            key={query}
            maxLength={120}
            placeholder="Search courses, subjects, publishers…"
            className="field w-full pl-11"
          />
        </div>
        <Button type="submit" className="h-12 rounded-full px-6">
          Search
        </Button>
      </form>
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50"
        aria-live="polite"
      >
        <p>
          {total
            ? `${(page - 1) * COURSES_PER_PAGE + 1}–${Math.min(page * COURSES_PER_PAGE, total)} of ${total} courses`
            : '0 courses'}
          {query && <> for “{query}”</>}
        </p>
        {query && (
          <Link
            href={catalogHref('', 1, basePath)}
            className="text-primary underline underline-offset-4"
          >
            Clear search
          </Link>
        )}
      </div>
      {courses.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const active = course.id === activeCourseId;
            const units = course.units?.[0]?.count ?? 0;
            return (
              <article
                key={course.id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/[0.035] transition-colors hover:border-white/30 hover:bg-white/[0.055]"
              >
                <div className="relative flex h-28 items-end justify-between overflow-hidden border-b border-white/10 bg-gradient-to-br from-cyan-400/15 via-blue-400/5 to-violet-400/10 p-5">
                  <BookOpen
                    size={32}
                    strokeWidth={1.25}
                    aria-hidden="true"
                    className="text-cyan-100/65"
                  />
                  <span className="label-mono max-w-[70%] truncate rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] text-white/70">
                    {course.subject}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h3 className="text-foreground text-base leading-relaxed font-medium break-words">
                    {course.title}
                  </h3>
                  <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                    {course.description ||
                      'Explore this course with your teacher, one conversation at a time.'}
                  </p>
                  <p className="mt-auto pt-2 text-xs text-white/45">
                    {units} {units === 1 ? 'unit' : 'units'}
                    {course.publisher && (
                      <span className="mt-1 block truncate">{course.publisher}</span>
                    )}
                  </p>
                  {active ? (
                    <Link
                      href={activeHref}
                      className="text-primary flex h-10 items-center justify-between rounded-full border border-cyan-300/25 px-4 text-xs"
                    >
                      Currently learning <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ) : units && !enroll ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-between rounded-full text-xs"
                    >
                      <Link href={signInHref}>
                        Sign in to start <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : units ? (
                    <form action={enroll}>
                      <input type="hidden" name="course_id" value={course.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full justify-between rounded-full text-xs"
                      >
                        {activeCourseId ? 'Study this course' : 'Start learning'}{' '}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </form>
                  ) : (
                    <p className="flex h-10 items-center text-xs text-white/40">Coming soon</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
          <BookOpen size={28} aria-hidden="true" className="mx-auto mb-4 text-white/40" />
          <h3 className="text-foreground mb-2 text-lg">
            {query ? 'No courses found' : 'More to learn, coming soon'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {query
              ? 'Try a different subject or a shorter search.'
              : 'Courses will appear here as they become available.'}
          </p>
        </div>
      )}
      {pages > 1 && (
        <nav
          aria-label="Course catalog pages"
          className="flex flex-wrap items-center justify-center gap-1 border-t border-white/10 pt-5"
        >
          {page > 1 ? (
            <Link
              href={catalogHref(query, page - 1, basePath)}
              className={pageLink}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              aria-label="Previous page"
              className={`${pageLink} opacity-25`}
            >
              <ChevronLeft size={16} />
            </span>
          )}
          {catalogPages(page, pages).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-white/40">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={catalogHref(query, item, basePath)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={`${pageLink} ${item === page ? 'bg-cyan-300 text-black hover:bg-cyan-200' : 'text-white/65'}`}
              >
                {item}
              </Link>
            )
          )}
          {page < pages ? (
            <Link
              href={catalogHref(query, page + 1, basePath)}
              className={pageLink}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span aria-disabled="true" aria-label="Next page" className={`${pageLink} opacity-25`}>
              <ChevronRight size={16} />
            </span>
          )}
        </nav>
      )}
    </section>
  );
}
