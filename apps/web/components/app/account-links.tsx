'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

/** Top-right links: learning record, settings (BYOK), sign in / out. */
export function AccountLinks() {
  const { enabled, user, loading, signOut } = useAuth();
  const router = useRouter();
  const link = 'text-muted-foreground hover:text-foreground text-xs';

  return (
    <nav className="flex items-center gap-4" aria-label="Account">
      {enabled && user && (
        <Link href="/profile" className={link}>
          Learning record
        </Link>
      )}
      <Link href="/settings" className={link}>
        Settings
      </Link>
      {enabled && !loading && !user && (
        <Link href="/login" className={link}>
          Sign in
        </Link>
      )}
      {enabled && user && (
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
