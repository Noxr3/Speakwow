'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LiquidGlass } from '@/components/ui/liquid-glass';

interface PhoneStatus {
  enabled: boolean;
  line: string | null;
  signedIn: boolean;
  phones: { phone: string; sms_opted_out: boolean }[];
}

/**
 * Link a phone to call and text the teacher. A code is texted to the number
 * first; once it checks out, calls and texts from that number are this
 * student, with everything the teacher remembers.
 */
export function PhoneForm() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch('/api/phone')
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));

  useEffect(() => {
    load();
  }, [user]);

  const call = async (method: 'POST' | 'PUT' | 'DELETE', body: unknown) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/phone', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    return { ok: res.ok, data };
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, data } = await call('POST', { phone });
    if (!ok) return setMessage({ ok: false, text: data.message ?? 'Could not send a code.' });
    if (data.linked) {
      setMessage({ ok: true, text: 'This number is already linked.' });
      return load();
    }
    setPending(data.phone);
    setCode('');
    setMessage({ ok: true, text: `We texted a code to ${data.phone}.` });
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, data } = await call('PUT', { phone: pending, code });
    if (!ok) return setMessage({ ok: false, text: data.message ?? 'That code is not right.' });
    setPending(null);
    setPhone('');
    setMessage({ ok: true, text: 'Linked. You can call and text your teacher now.' });
    load();
  };

  const unlink = async (number: string) => {
    const { ok, data } = await call('DELETE', { phone: number });
    if (!ok) return setMessage({ ok: false, text: data.message ?? 'Could not unlink.' });
    load();
  };

  return (
    <LiquidGlass radius={28} tint={0.3}>
      <section className="space-y-5 p-6 md:p-7">
        <div className="space-y-1.5">
          <h2 className="text-foreground text-lg font-medium">Phone</h2>
          <p className="text-muted-foreground text-sm">
            {status?.line
              ? `Call or text your teacher at ${status.line}.`
              : 'Call and text your teacher from your phone.'}
          </p>
        </div>

        {status && !status.enabled && (
          <p className="text-muted-foreground rounded-2xl bg-white/[0.04] p-4 text-sm">
            Not enabled on this server.
          </p>
        )}

        {status?.enabled && !status.signedIn && (
          <p className="text-muted-foreground rounded-2xl bg-white/[0.04] p-4 text-sm">
            Sign in to link your phone.
          </p>
        )}

        {status?.phones.map((p) => (
          <div
            key={p.phone}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
          >
            <span className="text-foreground font-mono">{p.phone}</span>
            {p.sms_opted_out && (
              <span className="text-muted-foreground text-xs">Texts off (you sent STOP)</span>
            )}
            <button
              type="button"
              onClick={() => unlink(p.phone)}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground ml-auto text-xs underline"
            >
              Unlink
            </button>
          </div>
        ))}

        {status?.enabled && status.signedIn && !pending && (
          <form onSubmit={send} className="space-y-3">
            <input
              id="phone-number"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900123"
              aria-label="Phone number with country code"
              className="field"
            />
            <Button
              type="submit"
              className="rounded-full px-5"
              disabled={busy || phone.trim().length < 8}
            >
              {busy ? 'Sending…' : 'Text me a code'}
            </Button>
          </form>
        )}

        {pending && (
          <form onSubmit={verify} className="space-y-3">
            <input
              id="phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code"
              aria-label="Code from the text message"
              className="field"
            />
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                className="rounded-full px-5"
                disabled={busy || code.trim().length < 4}
              >
                {busy ? 'Checking…' : 'Link this number'}
              </Button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Use another number
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-destructive'}`}>
            {message.text}
          </p>
        )}
      </section>
    </LiquidGlass>
  );
}
