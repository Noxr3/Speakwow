'use client';

import { TokenSource } from 'livekit-client';
import { toast } from 'sonner';
import { loadGuestKey } from '@/lib/client-prefs';

export type CallMode = 'free' | 'course';

export interface CallChoice {
  persona: string;
  mode: CallMode;
}

/**
 * Token source that asks the connection-details route for a token with the
 * student's current choice of teacher and mode. A guest's own API key (kept
 * in this browser) rides along; the route seals it before the agent sees it.
 */
export function getAgentTokenSource(choiceRef: { current: CallChoice }) {
  const endpoint = process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT || '/api/connection-details';
  return TokenSource.custom(async () => {
    const url = new URL(endpoint, window.location.origin);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...choiceRef.current, byok: loadGuestKey() ?? undefined }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      const message = body?.message ?? 'Could not start the call. Please try again.';
      toast.error(message);
      throw new Error(message);
    }
    return await res.json();
  });
}
