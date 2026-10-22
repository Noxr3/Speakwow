'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useChat, useDataChannel } from '@livekit/components-react';
import { STICKERS, STICKER_TOPIC, type Sticker, stickerImageUrl } from '@speakwow/shared';
import { WidgetCard } from '@/components/app/widget-card';
import {
  type CardUpdate,
  EVENT_TOPIC,
  WIDGET_TOPIC,
  type Widget,
  cardEvent,
  parseCardUpdate,
  parseWidget,
} from '@/lib/widgets';

const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

export interface Burst {
  key: number;
  sticker: Sticker;
  fromStudent: boolean;
}

export function StickerImage({ sticker, size }: { sticker: Sticker; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{ fontSize: size * 0.8, lineHeight: 1 }} role="img" aria-label={sticker.label}>
        {sticker.emoji}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stickerImageUrl(sticker)}
      alt={sticker.label}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

/**
 * Stickers flying in from the teacher (data channel) and from the student
 * (the reaction picker, sent as an emoji chat message the teacher reads).
 * Used once per call (session-view), shared by the overlays and the picker.
 */
export function useStickers() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const { send } = useChat();

  const pop = useCallback((sticker: Sticker, fromStudent: boolean) => {
    const key = Date.now() + Math.random();
    setBursts((list) => [...list.slice(-3), { key, sticker, fromStudent }]);
    window.setTimeout(() => setBursts((list) => list.filter((b) => b.key !== key)), 2600);
  }, []);

  useDataChannel(STICKER_TOPIC, (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      const sticker = BY_ID.get(data?.id);
      if (data?.type === 'sticker' && sticker) pop(sticker, false);
    } catch {
      // ignore malformed messages
    }
  });

  const sendSticker = async (sticker: Sticker) => {
    pop(sticker, true);
    try {
      await send(sticker.emoji);
    } catch {
      // the sticker still showed locally; the call carries on
    }
  };

  return { bursts, sendSticker };
}

/** The stickers in flight and the teacher's interactive card. */
export function LiveOverlays({ bursts }: { bursts: Burst[] }) {
  const [widget, setWidget] = useState<Widget | null>(null);
  const [cardUpdate, setCardUpdate] = useState<CardUpdate | null>(null);
  // What the student does on a card goes on its own topic, never as a chat
  // line: a tap must not interrupt the teacher (widgets.py).
  const { send: sendCardEvent } = useDataChannel(EVENT_TOPIC);

  useDataChannel(WIDGET_TOPIC, (msg) => {
    const next = parseWidget(msg.payload);
    if (next) {
      setWidget(next);
      setCardUpdate(null);
      return;
    }
    const update = parseCardUpdate(msg.payload);
    if (update) setCardUpdate(update);
  });

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40" aria-live="polite">
        <AnimatePresence>
          {bursts.map(({ key, sticker, fromStudent }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.3, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -80 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="absolute"
              style={{
                left: fromStudent ? '62%' : '38%',
                top: fromStudent ? '52%' : '22%',
                transform: 'translateX(-50%)',
              }}
            >
              <StickerImage sticker={sticker} size={fromStudent ? 72 : 112} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {widget && (
          <motion.div
            key={widget.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-3 top-16 z-40 mx-auto max-h-[60svh] max-w-md overflow-y-auto rounded-[28px] md:top-20"
          >
            <WidgetCard
              widget={widget}
              update={cardUpdate}
              onEvent={(action) =>
                sendCardEvent(new TextEncoder().encode(cardEvent(widget, action)), {
                  reliable: true,
                }).catch(() => undefined)
              }
              onClose={() => setWidget(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
