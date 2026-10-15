'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const timerRef = useRef<number | undefined>(undefined);

  // Open on the teacher this browser picked last time.
  useEffect(() => {
    const ids = personas.map((p) => p.id);
    setFirst(Math.max(0, ids.indexOf(loadPersonaId(ids, ids[0]))));
    setVoiceOn(loadVoicePreview());
    let live = true;
    loadCardFont().then((url) => live && setFont(url));
    return () => {
      live = false;
      window.clearTimeout(timerRef.current);
      audioRef.current?.pause();
    };
  }, [personas]);

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
    <div className="relative h-[min(360px,42svh)] w-full max-w-4xl">
      {first !== null && font !== undefined ? (
        <CircularCarousel
          items={items}
          preset="cylinder"
          // One flat pane per card: bent cards are cut into overlapping strips,
          // and translucent glass shows every overlap as a seam.
          curve={0}
          intro="rise"
          cardWidth={196}
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
            const id = personas[order[index]].id;
            onSelect(id);
            playSample(id);
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center" aria-hidden="true">
          <div className="glass h-[272px] w-[196px] animate-pulse rounded-[20px]" />
        </div>
      )}
      <button
        type="button"
        onClick={toggleVoice}
        aria-pressed={voiceOn}
        aria-label={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        title={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        className="glass text-muted-foreground hover:text-foreground absolute right-3 bottom-3 rounded-full p-2.5 transition-colors"
      >
        {voiceOn ? <SpeakerHighIcon size={18} /> : <SpeakerSlashIcon size={18} />}
      </button>
    </div>
  );
}
