'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogIn, LogOut, Settings, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { userDisplay } from '@/lib/user-display';
import { UserAvatar } from './user-avatar';

export function UserMenu() {
  const { enabled, user, guest, loading, signOut } = useAuth();
  const member = Boolean(user) && !guest;
  const identity = userDisplay(user);
  const router = useRouter();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setError('');
    try {
      await signOut();
      setOpen(false);
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="user-trigger"
        disabled={loading || leaving}
        aria-label={loading ? 'Loading account' : 'User menu'}
      >
        <UserAvatar
          src={member ? identity.avatar : undefined}
          initials={member ? identity.initials : undefined}
        />
        <ChevronDown size={14} aria-hidden="true" className="mr-1 hidden sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="user-menu">
        <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3">
          <UserAvatar
            src={member ? identity.avatar : undefined}
            initials={member ? identity.initials : undefined}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{member ? identity.name : 'Guest'}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs font-normal">
              {member ? user?.email || 'Your account' : 'Learn at your own pace'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {enabled && user && (
          <DropdownMenuItem asChild>
            <Link href="/profile" aria-current={pathname === '/profile' ? 'page' : undefined}>
              <UserRound aria-hidden="true" /> Profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings" aria-current={pathname === '/settings' ? 'page' : undefined}>
            <Settings aria-hidden="true" /> Settings
          </Link>
        </DropdownMenuItem>
        {enabled && (
          <>
            <DropdownMenuSeparator />
            {member ? (
              <DropdownMenuItem
                disabled={leaving}
                onSelect={(event) => {
                  event.preventDefault();
                  void leave();
                }}
              >
                <LogOut aria-hidden="true" /> {leaving ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href="/login">
                  <LogIn aria-hidden="true" /> Sign in
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
