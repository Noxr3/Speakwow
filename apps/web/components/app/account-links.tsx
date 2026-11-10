'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

/** Top-right links: learning profile, settings, sign in / out. */
export function AccountLinks() {
  const { enabled, user, guest, loading, signOut } = useAuth();
  // a guest (anonymous user) has a record to look at, but still signs in
  const member = Boolean(user) && !guest;
  const router = useRouter();
  const link = 'text-white/50 hover:text-white text-xs whitespace-nowrap transition-colors';

  return (
    <nav className="flex items-center gap-3.5 md:gap-5" aria-label="Account">
      {enabled && user && (
        <Link href="/profile" className={link}>
          Learning profile
        </Link>
      )}
      <Link href="/settings" className={link}>
        Settings
      </Link>
      {enabled && !loading && !member && (
        <Link href="/login" className={link}>
          Sign in
        </Link>
      )}
      {enabled && member && (
        <button
          type="button"
          className={link}
          onClick={async () => {
            await signOut();
            router.push('/');
            router.refresh();
          }}
        >
          Sign out
        </button>
      )}
    </nav>
  );
}
