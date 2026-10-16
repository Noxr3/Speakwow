/** Same-site paths only, so ?next= cannot send someone to another site. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}
