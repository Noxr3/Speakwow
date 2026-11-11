import type { User } from '@supabase/supabase-js';

type Identity = Pick<User, 'email' | 'user_metadata'>;

/** Provider metadata is untyped; only render known string fields. */
export function userDisplay(user: Identity | null) {
  const metadata = user?.user_metadata ?? {};
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name =
    text(metadata.display_name) ||
    text(metadata.full_name) ||
    text(metadata.name) ||
    user?.email?.split('@')[0] ||
    'Learner';
  const image = text(metadata.avatar_url) || text(metadata.picture);
  let avatar: string | undefined;
  try {
    const url = new URL(image);
    if (url.protocol === 'https:') avatar = url.href;
  } catch {
    /* Missing or invalid provider image: use initials. */
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
  return { name, avatar, initials };
}
