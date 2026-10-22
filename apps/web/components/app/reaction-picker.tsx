'use client';

import { useEffect, useRef, useState } from 'react';
import { SmileIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { STICKERS, type Sticker } from '@speakwow/shared';
import { Toggle } from '@/components/ui/toggle';

/** The stickers the student can send; the teacher can use the whole set. */
export const TRAY = ['laugh', 'wow', 'thinking', 'sweat_smile', 'clap', 'heart', 'sleepy', 'party'];
const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));
// Moving from the button up to the row crosses a small gap.
const HOVER_GRACE_MS = 250;

interface ReactionPickerProps {
  onPick: (sticker: Sticker) => void;
  /** the control bar's own toggle classes (AgentControlBar `extra`) */
  className?: string;
}

/**
 * A smiley in the control bar; the sticker row shows only when asked for,
 * the way Google Meet's reactions do. A row that was always there sat over
 * the last lines of the transcript.
 *
 * A mouse opens it by hovering, and it closes when the pointer leaves. A tap
 * (or Enter) pins it open; picking a sticker by touch closes it again, so
 * the captions are free. The row is placed by the nearest positioned
 * ancestor: in the call, the control bar's wrapper, so it sits centred above
 * the bar rather than above this one button.
 */
export function ReactionPicker({ onPick, className }: ReactionPickerProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const root = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  return (
    <div
      ref={root}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(leaveTimer.current);
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(() => setHovered(false), HOVER_GRACE_MS);
      }}
    >
      <Toggle
        aria-label="Send a reaction"
        aria-expanded={open}
        aria-haspopup="true"
        pressed={open}
        onPressedChange={() => setPinned((p) => !p)}
        className={className}
      >
        <SmileIcon />
      </Toggle>

      <AnimatePresence>
        {open && (
          <motion.div
            key="row"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2"
          >
            <div
              role="toolbar"
              aria-label="Reactions"
              className="flex flex-wrap justify-center gap-0.5 rounded-full border border-white/15 bg-neutral-950/85 p-1 shadow-xl backdrop-blur-xl"
            >
              {TRAY.map((id) => {
                const sticker = BY_ID.get(id)!;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => {
                      onPick(sticker);
                      // a mouse can send several; a finger gets the captions back
                      if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse') {
                        setPinned(false);
                        setHovered(false);
                      }
                    }}
                    title={`Send ${sticker.label}`}
                    aria-label={`Send ${sticker.label} sticker`}
                    className="rounded-full p-1.5 text-2xl leading-none transition-transform hover:scale-115 hover:bg-white/10 active:scale-95"
                  >
                    {sticker.emoji}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
