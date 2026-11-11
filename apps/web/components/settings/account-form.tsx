'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/app/user-avatar';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { userDisplay } from '@/lib/user-display';

export function AccountForm() {
  const { enabled, user, guest, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const identity = userDisplay(user);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const name = draft ?? identity.name;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !user || guest || !name.trim() || name.trim().length > 80) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      if (error) throw error;
      setDraft(null);
      setMessage({ ok: true, text: 'Your name has been updated.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save your name. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="content-panel panel-padding space-y-5" aria-labelledby="account-heading">
      <h2 id="account-heading" className="section-title">
        Account
      </h2>
      {loading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading your account…
        </p>
      ) : !user || guest ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Sign in to manage your account and keep your learning across devices.
          </p>
          {enabled && (
            <Button asChild variant="secondary">
              <Link href="/login?next=/settings">Sign in</Link>
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="space-y-5">
          <div className="flex items-center gap-3">
            <UserAvatar src={identity.avatar} initials={identity.initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{identity.name}</p>
              <p className="text-muted-foreground truncate text-sm">{user.email || 'Signed in'}</p>
            </div>
          </div>
          <label className="grid gap-2 text-sm" htmlFor="display-name">
            Display name
            <input
              id="display-name"
              name="display-name"
              className="field"
              autoComplete="nickname"
              maxLength={80}
              required
              value={name}
              onChange={(event) => {
                setDraft(event.target.value);
                setMessage(null);
              }}
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy || !name.trim() || name.trim() === identity.name}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
          {message && (
            <p
              role={message.ok ? 'status' : 'alert'}
              className={`text-sm ${message.ok ? 'text-success' : 'text-destructive'}`}
            >
              {message.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
