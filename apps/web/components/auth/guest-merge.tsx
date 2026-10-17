'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import {
  type GuestStash,
  clearGuestStash,
  loadGuestStash,
  mergeChoice,
  updateGuestStash,
} from '@/lib/guest';

interface Answer {
  ok: boolean;
  status: number;
  body: {
    guestLessons?: number;
    accountLessons?: number;
    refresh_token?: string;
  };
}

async function guestAction(action: 'peek' | 'merge' | 'discard', stash: GuestStash) {
  const res = await fetch('/api/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, refresh_token: stash.refreshToken }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => ({}))) ?? {};
  if (body.refresh_token) updateGuestStash(stash, body.refresh_token);
  return { ok: Boolean(res?.ok), status: res?.status ?? 0, body } as Answer;
}

function calls(n: number) {
  return `${n} practice ${n === 1 ? 'call' : 'calls'}`;
}

/**
 * After sign-in: what they practised as a guest (lib/guest.ts). A new
 * account takes it over without asking; an account with its own record is
 * asked whether to add it.
 */
export function GuestMerge() {
  const { enabled, user, guest } = useAuth();
  const router = useRouter();
  const [asking, setAsking] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user || guest || handled.current === user.id) return;
    const stash = loadGuestStash();
    if (!stash) return;
    handled.current = user.id;
    if (stash.id === user.id) {
      clearGuestStash(); // the guest became this account: nothing to move
      return;
    }
    (async () => {
      const peek = await guestAction('peek', stash);
      if (!peek.ok) {
        if (peek.status === 410) clearGuestStash();
        return;
      }
      const lessons = peek.body.guestLessons ?? 0;
      const choice = mergeChoice({
        guestLessons: lessons,
        accountLessons: peek.body.accountLessons ?? 0,
      });
      if (choice === 'ask') {
        setAsking(lessons);
        return;
      }
      const done = await guestAction(choice, loadGuestStash() ?? stash);
      if (done.ok || done.status === 410) clearGuestStash();
      if (done.ok && choice === 'merge') {
        setNotice(
          `Your ${calls(lessons)} from before you signed in ${lessons === 1 ? 'is' : 'are'} in your account now.`
        );
        router.refresh();
      }
    })();
  }, [enabled, user, guest, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const decide = async (action: 'merge' | 'discard') => {
    const stash = loadGuestStash();
    if (!stash) {
      setAsking(null);
      return;
    }
    setBusy(true);
    const done = await guestAction(action, stash);
    setBusy(false);
    if (!done.ok && done.status !== 410) {
      setNotice('That did not work. Please try again in a moment.');
      return;
    }
    clearGuestStash();
    setAsking(null);
    if (done.ok && action === 'merge') {
      setNotice('Added to your account.');
      router.refresh();
    }
  };

  if (asking === null && !notice) return null;
  return (
    <div
      role={asking !== null ? 'dialog' : 'status'}
      aria-live="polite"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl border border-white/15 bg-black/80 p-5 shadow-2xl backdrop-blur-xl"
    >
      {asking !== null ? (
        <div className="space-y-4">
          <p className="text-sm text-white/85">
            You had {calls(asking)} before you signed in. Add {asking === 1 ? 'it' : 'them'} to your
            learning record?
          </p>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-full" disabled={busy} onClick={() => decide('merge')}>
              Add to my record
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full border-white/15 bg-white/[0.04]"
              disabled={busy}
              onClick={() => decide('discard')}
            >
              No, discard
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/85">{notice}</p>
      )}
    </div>
  );
}
