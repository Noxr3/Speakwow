'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserMenu } from './user-menu';

/** Learning navigation stays visible; account actions share one avatar menu. */
export function AccountLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-2 sm:gap-4" aria-label="Navigation">
      <Link
        href="/courses"
        aria-current={pathname.startsWith('/courses') ? 'page' : undefined}
        className="nav-link"
      >
        Courses
      </Link>
      <UserMenu />
    </nav>
  );
}
