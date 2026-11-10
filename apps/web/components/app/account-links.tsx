'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Top-right links: courses, profile, settings, sign in / out. */
export function AccountLinks() {
  const { enabled, user, guest, loading, signOut } = useAuth();
  // a guest (anonymous user) has a record to look at, but still signs in
  const member = Boolean(user) && !guest;
  const router = useRouter();
  const pathname = usePathname();
  const link = 'nav-link';
  const leave = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Navigation menu"
            className="text-foreground flex h-11 w-11 items-center justify-center rounded-full bg-white/8 hover:bg-white/15"
          >
            <Menu size={20} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem asChild className="min-h-11">
              <Link href="/courses">Courses</Link>
            </DropdownMenuItem>
            {enabled && user && (
              <DropdownMenuItem asChild className="min-h-11">
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="min-h-11">
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            {enabled && !loading && !member && (
              <DropdownMenuItem asChild className="min-h-11">
                <Link href="/login">Sign in</Link>
              </DropdownMenuItem>
            )}
            {enabled && member && (
              <DropdownMenuItem onSelect={() => void leave()} className="min-h-11">
                Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className="hidden items-center gap-1 sm:flex" aria-label="Navigation">
        <Link
          href="/courses"
          aria-current={pathname === '/courses' ? 'page' : undefined}
          className={link}
        >
          Courses
        </Link>
        {enabled && user && (
          <Link
            href="/profile"
            aria-current={pathname === '/profile' ? 'page' : undefined}
            className={link}
          >
            Profile
          </Link>
        )}
        <Link
          href="/settings"
          aria-current={pathname === '/settings' ? 'page' : undefined}
          className={link}
        >
          Settings
        </Link>
        {enabled && !loading && !member && (
          <Link
            href="/login"
            aria-current={pathname === '/login' ? 'page' : undefined}
            className={link}
          >
            Sign in
          </Link>
        )}
        {enabled && member && (
          <button type="button" className={link} onClick={leave}>
            Sign out
          </button>
        )}
      </nav>
    </>
  );
}
