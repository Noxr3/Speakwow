'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const link = 'text-white/50 hover:text-white text-xs whitespace-nowrap transition-colors';
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
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
      <nav className="hidden items-center gap-3.5 sm:flex md:gap-5" aria-label="Navigation">
        <Link href="/courses" className={link}>
          Courses
        </Link>
        {enabled && user && (
          <Link href="/profile" className={link}>
            Profile
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
          <button type="button" className={link} onClick={leave}>
            Sign out
          </button>
        )}
      </nav>
    </>
  );
}
