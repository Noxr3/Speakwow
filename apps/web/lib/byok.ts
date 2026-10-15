/**
 * Bring your own key: seal a student's model API key so it is never stored or
 * relayed in clear text. Server-only (node:crypto).
 *
 * The sealed form travels in the database and the LiveKit job metadata; only
 * the voice agent, which shares BYOK_ENCRYPTION_KEY, can open it. Format,
 * mirrored by apps/agent/src/byok.py:
 *
 *   v1.<base64url(iv[12] || ciphertext || tag[16])>   AAD = "speakwow-byok-v1"
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const BYOK_PROVIDERS = ['xai', 'openai'] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

export interface UserKey {
  provider: ByokProvider;
  key: string;
}

const AAD = Buffer.from('speakwow-byok-v1');
const PREFIX = 'v1.';

export function isByokProvider(value: unknown): value is ByokProvider {
  return typeof value === 'string' && (BYOK_PROVIDERS as readonly string[]).includes(value);
}

/** BYOK_ENCRYPTION_KEY: 32 random bytes, base64 or base64url. */
export function byokSecret(raw: string | undefined = process.env.BYOK_ENCRYPTION_KEY) {
  if (!raw) return null;
  const secret = Buffer.from(raw.trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return secret.length === 32 ? secret : null;
}

export function sealUserKey(value: UserKey, secret: Buffer, iv: Buffer = randomBytes(12)): string {
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ provider: value.provider, key: value.key }), 'utf8'),
    cipher.final(),
  ]);
  return PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
}

export function openUserKey(sealed: string, secret: Buffer): UserKey | null {
  if (typeof sealed !== 'string' || !sealed.startsWith(PREFIX)) return null;
  try {
    const blob = Buffer.from(sealed.slice(PREFIX.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', secret, blob.subarray(0, 12));
    decipher.setAAD(AAD);
    decipher.setAuthTag(blob.subarray(blob.length - 16));
    const plain = Buffer.concat([
      decipher.update(blob.subarray(12, blob.length - 16)),
      decipher.final(),
    ]).toString('utf8');
    const data = JSON.parse(plain);
    if (!isByokProvider(data?.provider) || typeof data?.key !== 'string' || !data.key) return null;
    return { provider: data.provider, key: data.key };
  } catch {
    return null;
  }
}

/** A cheap shape check that catches pasting the wrong thing; the provider decides the rest. */
export function looksLikeApiKey(key: unknown): key is string {
  return typeof key === 'string' && /^[\x21-\x7e]{20,300}$/.test(key);
}

/** What the UI may show about a saved key: its last four characters. */
export function keyHint(key: string): string {
  return key.slice(-4);
}
