/**
 * A fixed-window counter in Vercel KV (Upstash Redis over REST), for things
 * that cost money per call, like texting a verification code. Server-only.
 *
 *   KV_REST_API_URL, KV_REST_API_TOKEN   set by the Vercel KV integration
 *
 * Without KV (local development) or when KV fails, it allows: Twilio Verify
 * still limits how often one number can be sent a code.
 */

type Fetch = typeof fetch;

export async function underLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: Fetch = fetch
): Promise<boolean> {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!url || !token) return true;
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds), 'NX'],
      ]),
    });
    if (!res.ok) return true;
    const [incr] = (await res.json()) as { result?: unknown }[];
    return Number(incr?.result) <= limit;
  } catch {
    return true;
  }
}

/** The caller's address as Vercel reports it, for per-address limits. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  );
}
