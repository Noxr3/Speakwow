'use client';

import type { ComponentProps } from 'react';

/** These filters already have all their data. History updates preserve URLs/back
 * without another RSC request; modified clicks remain ordinary browser navigation. */
export function CourseFilterLink({
  href,
  scroll = true,
  onClick,
  ...props
}: ComponentProps<'a'> & { href: string; scroll?: boolean }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== '_self')
        )
          return;
        event.preventDefault();
        window.history.pushState(null, '', href);
        if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
      }}
    />
  );
}
