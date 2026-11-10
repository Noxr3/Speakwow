'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/shadcn/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('pr-8 text-xl font-semibold', className)} {...props} />;
}
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'border-border bg-card fixed top-1/2 left-1/2 z-[61] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border p-6 shadow-2xl sm:p-8',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close plan"
          className="text-muted-foreground absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/5"
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
