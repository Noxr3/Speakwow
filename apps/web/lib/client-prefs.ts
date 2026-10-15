/**
 * What a browser remembers between visits. Every read and write is wrapped:
 * storage can be missing or throw (private mode, blocked site data), and the
 * app must work without it.
 */
export type GuestKey = { provider: 'xai' | 'openai'; key: string };

const GUEST_KEY = 'speakwow.byok';
const PERSONA = 'speakwow.persona';
const LEGACY_PERSONA = 'selectedAgent'; // "Frank" | "Lucy", before persona ids

function read(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function write(name: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
  } catch {
    // not persisted; the current page still works
  }
}

export function loadGuestKey(): GuestKey | null {
  try {
    const value = JSON.parse(read(GUEST_KEY) ?? 'null');
    return value && (value.provider === 'xai' || value.provider === 'openai') && value.key
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveGuestKey(value: GuestKey | null) {
  write(GUEST_KEY, value ? JSON.stringify(value) : null);
}

export function loadPersonaId(known: string[], fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const stored = (read(PERSONA) ?? read(LEGACY_PERSONA) ?? '').toLowerCase();
  return known.includes(stored) ? stored : fallback;
}

export function savePersonaId(id: string) {
  write(PERSONA, id);
}

const VOICE_PREVIEW = 'speakwow.voicePreview';

/** Whether turning to a teacher plays their voice sample (on unless turned off). */
export function loadVoicePreview(): boolean {
  return read(VOICE_PREVIEW) !== 'off';
}

export function saveVoicePreview(on: boolean) {
  write(VOICE_PREVIEW, on ? 'on' : 'off');
}
