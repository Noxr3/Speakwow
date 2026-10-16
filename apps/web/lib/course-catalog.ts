export const COURSES_PER_PAGE = 6;
export type CatalogParams = { q?: string | string[]; page?: string | string[] };

/** URL state is shareable and survives reload/back; searches always start at page 1. */
export function catalogParams(params: CatalogParams) {
  const q = (typeof params.q === 'string' ? params.q : '').trim().slice(0, 120);
  const raw = typeof params.page === 'string' ? params.page : '';
  const parsed = /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  const page = Math.max(1, parsed);
  return { q, page, from: (page - 1) * COURSES_PER_PAGE, to: page * COURSES_PER_PAGE - 1 };
}

/** Escape SQL LIKE metacharacters; searching for % must not match every course. */
export function catalogPattern(q: string) {
  return `%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
}

export function catalogHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  return `/profile${params.size ? `?${params}` : ''}#courses`;
}

export function catalogPages(page: number, pages: number): (number | 'gap')[] {
  const visible = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...visible].filter((p) => p > 0 && p <= pages).sort((a, b) => a - b);
  return list.flatMap((p, i) => (i && p - list[i - 1] > 1 ? ['gap' as const, p] : [p]));
}
