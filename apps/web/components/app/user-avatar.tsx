'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';

export function UserAvatar({ src, initials }: { src?: string; initials?: string }) {
  const [failed, setFailed] = useState<string>();
  return (
    <span className="user-avatar" aria-hidden="true">
      {src && failed !== src ? (
        // Provider avatars have dynamic hosts; no image optimization is needed at 36px.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={36}
          height={36}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : initials ? (
        initials
      ) : (
        <UserRound size={18} />
      )}
    </span>
  );
}
