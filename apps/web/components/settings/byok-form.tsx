'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { type GuestKey, loadGuestKey, saveGuestKey } from '@/lib/client-prefs';

type Provider = GuestKey['provider'];

interface ByokStatus {
  enabled: boolean;
  required: boolean;
  signedIn: boolean;
  saved: { provider: Provider; key_hint: string; updated_at: string } | null;
}

const PROVIDERS: { id: Provider; name: string; hint: string; url: string }[] = [
  {
    id: 'xai',
    name: 'xAI',
    hint: '',
    url: 'https://console.x.ai',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    hint: '',
    url: 'https://platform.openai.com/api-keys',
  },
];

/**
 * Bring your own key. Signed in: the key is sealed on the server and saved to
 * the account; only its last four characters are ever shown again. Guest: it
 * stays in this browser and is sealed by the server for each call.
 */
export function ByokForm() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ByokStatus | null>(null);
  const [guestKey, setGuestKey] = useState<GuestKey | null>(null);
  const [provider, setProvider] = useState<Provider>('xai');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setGuestKey(loadGuestKey());
    fetch('/api/byok')
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [user]);

  const signedIn = Boolean(status?.signedIn);
  const current = signedIn
    ? status?.saved && { provider: status.saved.provider, hint: status.saved.key_hint }
    : guestKey && { provider: guestKey.provider, hint: guestKey.key.slice(-4) };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const trimmed = key.trim();
    if (!signedIn) {
      saveGuestKey({ provider, key: trimmed });
      setGuestKey({ provider, key: trimmed });
      setKey('');
      setMessage({ ok: true, text: 'Saved in this browser.' });
      return;
    }
    setBusy(true);
    const res = await fetch('/api/byok', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key: trimmed }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: body.message ?? 'Could not save the key.' });
      return;
    }
    setStatus((s) => (s ? { ...s, saved: body.saved } : s));
    setKey('');
    setMessage({ ok: true, text: 'Saved to your account, encrypted.' });
  };

  const remove = async () => {
    setMessage(null);
    if (!signedIn) {
      saveGuestKey(null);
      setGuestKey(null);
      return;
    }
    setBusy(true);
    await fetch('/api/byok', { method: 'DELETE' });
    setBusy(false);
    setStatus((s) => (s ? { ...s, saved: null } : s));
  };

  return (
    <section className="glass space-y-5 rounded-3xl p-6 md:p-7">
      <div className="space-y-1.5">
        <h2 className="text-foreground text-lg font-medium">API key</h2>
        <p className="text-muted-foreground text-sm">
          {status?.required ? 'Required to start a call.' : 'Optional. Use your own model account.'}
        </p>
      </div>

      {status && !status.enabled && (
        <p className="text-muted-foreground rounded-2xl bg-white/[0.04] p-4 text-sm">
          Not enabled on this server.
        </p>
      )}

      {current && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
          <span className="text-foreground">
            {PROVIDERS.find((p) => p.id === current.provider)?.name} ·••••{current.hint}
          </span>
          <span className="text-muted-foreground text-xs">
            {signedIn ? 'Account' : 'This browser'}
          </span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground ml-auto text-xs underline"
          >
            Remove
          </button>
        </div>
      )}

      {status?.enabled && (
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer space-y-1 rounded-2xl border p-4 text-sm transition-colors ${
                  provider === p.id
                    ? 'border-white/35 bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={provider === p.id}
                  onChange={() => setProvider(p.id)}
                  className="sr-only"
                />
                <span className="text-foreground block font-medium">{p.name}</span>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs underline"
                >
                  Get key
                </a>
              </label>
            ))}
          </div>
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your API key"
            aria-label="API key"
            className="field"
          />
          <Button
            type="submit"
            className="rounded-full px-5"
            disabled={busy || key.trim().length < 20}
          >
            {busy ? 'Saving…' : current ? 'Replace key' : 'Save key'}
          </Button>
          <p className="text-muted-foreground text-xs">
            {signedIn ? 'Encrypted before it is stored.' : 'Encrypted. Kept in this browser only.'}
          </p>
        </form>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
