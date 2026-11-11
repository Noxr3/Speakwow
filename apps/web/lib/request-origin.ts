/** JSON + same-origin blocks browser form/credentialed cross-site mutations. */
export function isSameOriginJson(request: Request): boolean {
  const origin = request.headers.get('origin');
  return (
    request.headers.get('content-type')?.split(';')[0].trim() === 'application/json' &&
    (!origin || origin === new URL(request.url).origin)
  );
}
