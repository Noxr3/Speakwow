import { cn } from '@/lib/shadcn/utils';

export function TeacherAvatar({ id, className }: { id: string; className?: string }) {
  return (
    // Local SVGs are already optimized; keep them out of the image transformation pipeline.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/teachers/dylan-v1/${encodeURIComponent(id)}.svg`}
      width={40}
      height={40}
      alt=""
      aria-hidden="true"
      decoding="async"
      className={cn('size-10 shrink-0 rounded-full ring-1 ring-white/15', className)}
    />
  );
}
