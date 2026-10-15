'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import type { PersonaSummary } from '@speakwow/shared';
import CircularCarousel from '@/components/CircularCarousel';
import { loadPersonaId, loadVoicePreview, saveVoicePreview } from '@/lib/client-prefs';
import { CARD_HEIGHT, CARD_WIDTH, teacherCardUrl } from '@/lib/teacher-card';

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
  const [voiceOn, setVoiceOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Open on the teacher this browser picked last time.
  useEffect(() => {
    const ids = personas.map((p) => p.id);
    setFirst(Math.max(0, ids.indexOf(loadPersonaId(ids, ids[0]))));
    setVoiceOn(loadVoicePreview());
    return () => {
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
        src: teacherCardUrl(personas[k]),
        alt: `${personas[k].display_name}: ${personas[k].tagline_en}`,
        title: personas[k].display_name,
        subtitle: personas[k].specialty_en,
      })),
    [order, personas]
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
    <div className="relative h-[330px] w-full max-w-3xl md:h-[390px]">
      {first !== null ? (
        <CircularCarousel
          items={items}
          preset="cylinder"
          intro="rise"
          cardWidth={200}
          aspectRatio={CARD_WIDTH / CARD_HEIGHT}
          gap={26}
          autoplay="off"
          snap
          draggable
          focusOnClick
          depthFade={0.7}
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
          <div className="h-[278px] w-[200px] animate-pulse rounded-[20px] bg-white/5" />
        </div>
      )}
      <button
        type="button"
        onClick={toggleVoice}
        aria-pressed={voiceOn}
        aria-label={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        title={voiceOn ? 'Mute voice samples' : 'Play voice samples'}
        className="text-muted-foreground hover:text-foreground absolute right-2 bottom-2 rounded-full p-2 transition-colors"
      >
        {voiceOn ? <SpeakerHighIcon size={18} /> : <SpeakerSlashIcon size={18} />}
      </button>
    </div>
  );
}
