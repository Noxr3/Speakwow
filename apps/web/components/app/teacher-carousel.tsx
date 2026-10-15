'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import type { PersonaSummary } from '@speakwow/shared';
import CircularCarousel from '@/components/CircularCarousel';
import { loadPersonaId, loadVoicePreview, saveVoicePreview } from '@/lib/client-prefs';
import { CARD_HEIGHT, CARD_WIDTH, loadCardFont, teacherCardUrl } from '@/lib/teacher-card';

interface TeacherCarouselProps {
  personas: PersonaSummary[];
  onSelect: (id: string) => void;
}

/** Wait for the ring to settle before speaking, so a fast spin stays quiet. */
const SAMPLE_DELAY_MS = 450;
const CARD_W = 196;

/**
 * The teachers on a 3D ring. Drag, scroll, use the arrow keys or click a card;
 * the card facing you is the teacher you will talk to, and when the ring
 * settles on someone new you hear their voice. Samples are
 * public/voices/<id>.mp3 (pnpm voices:generate); a missing one is silent.
 */
export function TeacherCarousel({ personas, onSelect }: TeacherCarouselProps) {
  const [first, setFirst] = useState<number | null>(null);
  const [font, setFont] = useState<string | null | undefined>(undefined);
  const [voiceOn, setVoiceOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [corner, setCorner] = useState<{ top: number; left: number } | null>(null);

  // Pin the sound toggle to the top-right corner of the card facing you. The
  // ring scales itself to fit, so measure the card rather than assume a size.
  const pinIcon = useCallback(() => {
    const wrap = wrapRef.current;
    const img = wrap?.querySelector(`[data-cc-index="${activeRef.current}"] img`);
    if (!wrap || !img) return;
    const box = wrap.getBoundingClientRect();
    const card = img.getBoundingClientRect();
    setCorner({ top: card.top - box.top + 8, left: card.right - box.left - 30 });
  }, []);
  const pinTimer = useRef<number | undefined>(undefined);
  const pinSoon = useCallback(
    (delay: number) => {
      setCorner(null);
      window.clearTimeout(pinTimer.current);
      pinTimer.current = window.setTimeout(pinIcon, delay);
    },
    [pinIcon]
  );
  const timerRef = useRef<number | undefined>(undefined);

  // Open on the teacher this browser picked last time.
  useEffect(() => {
    const ids = personas.map((p) => p.id);
    setFirst(Math.max(0, ids.indexOf(loadPersonaId(ids, ids[0]))));
    setVoiceOn(loadVoicePreview());
    const onResize = () => pinSoon(200);
    window.addEventListener('resize', onResize);
    let live = true;
    loadCardFont().then((url) => live && setFont(url));
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(pinTimer.current);
      live = false;
      window.clearTimeout(timerRef.current);
      audioRef.current?.pause();
    };
  }, [personas, pinSoon]);

  // After the ring's entrance animation.
  useEffect(() => {
    if (first !== null && font !== undefined) pinSoon(1600);
  }, [first, font, pinSoon]);

  const order = useMemo(
    () => personas.map((_, i) => (i + (first ?? 0)) % personas.length),
    [personas, first]
  );
  const items = useMemo(
    () =>
      order.map((k) => ({
        src: teacherCardUrl(personas[k], font),
        alt: `${personas[k].display_name}: ${personas[k].tagline_en}`,
        title: personas[k].display_name,
        subtitle: personas[k].specialty_en,
      })),
    [order, personas, font]
  );

  const playSample = (id: string) => {
    window.clearTimeout(timerRef.current);
    audioRef.current?.pause();
    if (!voiceOn) return;
    timerRef.current = window.setTimeout(() => {
      const audio = new Audio(`/voices/${id}.mp3`);
      audio.volume = 0.9;
      audioRef.current = audio;
      audio.play().catch(() => undefined); // no sample yet, or the browser said no
    }, SAMPLE_DELAY_MS);
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    saveVoicePreview(next);
    if (!next) audioRef.current?.pause();
  };

  return (
    <div ref={wrapRef} className="relative h-[min(360px,42svh)] w-full max-w-4xl">
      {first !== null && font !== undefined ? (
        <CircularCarousel
          items={items}
          preset="cylinder"
          // One flat pane per card: bent cards are cut into overlapping strips,
          // and translucent glass shows every overlap as a seam.
          curve={0}
          intro="rise"
          cardWidth={CARD_W}
          aspectRatio={CARD_WIDTH / CARD_HEIGHT}
          gap={26}
          autoplay="off"
          snap
          draggable
          focusOnClick
          depthFade={0.85}
          fadeColor="#000000"
          cornerRadius={20}
          onChange={(index) => {
            activeRef.current = index;
            pinSoon(650);
            const id = personas[order[index]].id;
            onSelect(id);
            playSample(id);
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center" aria-hidden="true">
          <div className="h-[272px] w-[196px] animate-pulse rounded-[20px] border border-white/10 bg-white/5" />
        </div>
      )}
      {/* Sits on the top-right corner of the card facing you. */}
      <button
        type="button"
        onClick={toggleVoice}
        aria-pressed={voiceOn}
        aria-label={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        title={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        className="absolute z-10 p-1.5 text-white/55 transition-[color,opacity] duration-300 hover:text-white"
        style={
          corner
            ? { top: corner.top, left: corner.left, opacity: 1 }
            : { opacity: 0, pointerEvents: 'none', top: 0, left: 0 }
        }
      >
        {voiceOn ? <SpeakerHighIcon size={14} /> : <SpeakerSlashIcon size={14} />}
      </button>
    </div>
  );
}
