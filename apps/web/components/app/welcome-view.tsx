'use client';

import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, MessageCircle, Search } from 'lucide-react';
import type { PersonaSummary } from '@speakwow/shared';
import ColorBends from '@/components/ColorBends';
import GlassSurface from '@/components/GlassSurface';
import Magnet from '@/components/Magnet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { type HomeLibrary, completedSessions, coursePosition } from '@/lib/study-plan';
import type { CallMode } from '@/lib/token-source';

interface WelcomeViewProps {
  personas: PersonaSummary[];
  persona: PersonaSummary;
  onSelectPersona: (id: string) => void;
  library: HomeLibrary;
  onSelectCourse: (id: string, unitId?: string) => Promise<void>;
  busy: boolean;
  mode: CallMode;
  onSelectMode: (mode: CallMode) => void;
  onStartCall: () => void;
}

export const WelcomeView = ({
  personas,
  persona,
  onSelectPersona,
  library,
  onSelectCourse,
  busy,
  mode,
  onSelectMode,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [query, setQuery] = useState('');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const course = library.courses.find((c) => c.id === library.selectedId);
  const position = course ? coursePosition(course) : null;
  const filtered = library.courses.filter((c) =>
    `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div ref={ref} className="mx-auto max-w-5xl px-5 pt-28 pb-16 sm:px-8 sm:pt-36">
      <section aria-labelledby="welcome-title" className="mb-14">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wow5-logo-white.png" alt="" className="h-10 w-auto" />
            <h1
              id="welcome-title"
              className="text-foreground font-mono text-2xl font-bold tracking-tight"
            >
              Speakwow
            </h1>
          </div>
          <p className="text-foreground text-sm">A teacher who remembers you.</p>
        </div>
        <div className="mt-8">
          <LiquidGlass radius={28} tint={0.88}>
            <div className="p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
                    {mode === 'course' && course ? (
                      <BookOpen size={17} />
                    ) : (
                      <MessageCircle size={17} />
                    )}
                    <span>
                      {mode === 'course' && course
                        ? position?.completed === position?.total
                          ? 'Course completed'
                          : 'Continue learning'
                        : 'Free conversation'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {mode === 'course' && course ? course.title : 'A moment to talk.'}
                  </h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {mode === 'course' && position?.unit
                      ? `${position.unit.title}${position.session ? ` · ${position.session.title}` : ''}`
                      : 'Catch up, follow a thought, or see where it takes you.'}
                  </p>
                  {mode === 'course' && course && position && (
                    <div className="mt-5 flex items-center gap-3">
                      <progress
                        className="study-progress w-16 shrink-0 sm:w-28"
                        max={position.total || 1}
                        value={position.completed}
                        aria-label={`${course.title} progress`}
                      />
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {position.completed} of {position.total} sessions
                      </span>
                      <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
                        <DialogTrigger className="text-primary min-h-11 text-xs whitespace-nowrap hover:underline">
                          View plan
                        </DialogTrigger>
                        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{course.title}</DialogTitle>
                          </DialogHeader>
                          <p className="text-muted-foreground text-sm">{course.description}</p>
                          <ol className="divide-border mt-3 divide-y">
                            {course.units.map((unit) => {
                              const done = completedSessions(unit.sessions, unit.progress);
                              return (
                                <li key={unit.id} className="py-3">
                                  <details open={unit.id === course.currentUnitId}>
                                    <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                                      <span className="text-muted-foreground w-6 tabular-nums">
                                        {done === unit.sessions.length ? (
                                          <Check size={16} />
                                        ) : (
                                          unit.position
                                        )}
                                      </span>
                                      <span className="flex-1 font-medium">{unit.title}</span>
                                      <span className="text-muted-foreground text-xs">
                                        {done}/{unit.sessions.length}
                                      </span>
                                      <ChevronDown size={14} />
                                    </summary>
                                    <ul className="ml-9 space-y-3 py-3 text-sm">
                                      {unit.sessions.map((session) => (
                                        <li
                                          key={session.id}
                                          className="flex items-center justify-between gap-4"
                                        >
                                          <span>{session.title}</span>
                                          <span className="text-muted-foreground text-xs">
                                            {unit.progress?.status === 'mastered' ||
                                            unit.progress?.session_progress?.[session.id]
                                              ?.status === 'mastered'
                                              ? 'Completed'
                                              : session.kind === 'exam'
                                                ? 'Assessment'
                                                : `${session.minutes ?? 10} min`}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    {unit.id !== course.currentUnitId && (
                                      <button
                                        disabled={busy}
                                        onClick={async () => {
                                          await onSelectCourse(course.id, unit.id);
                                          setOutlineOpen(false);
                                        }}
                                        className="text-primary ml-9 min-h-11 text-sm disabled:opacity-50"
                                      >
                                        Study this lesson
                                      </button>
                                    )}
                                  </details>
                                </li>
                              );
                            })}
                          </ol>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-center">
                  <Magnet padding={10} disabled={busy} magnetStrength={10}>
                    <button
                      disabled={busy}
                      onClick={onStartCall}
                      className="cursor-pointer rounded-full transition-transform duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <GlassSurface
                        className="rounded-full font-mono text-xs uppercase"
                        width={220}
                        height={48}
                        displace={0.5}
                        distortionScale={-180}
                        redOffset={70}
                        greenOffset={10}
                        blueOffset={20}
                        borderRadius={50}
                        brightness={50}
                        opacity={0.63}
                        backgroundOpacity={0.55}
                        mixBlendMode="screen"
                        forceDark
                      >
                        <span>
                          {busy
                            ? 'One moment…'
                            : mode === 'course' && course
                              ? 'Start lesson'
                              : 'Start talking'}
                        </span>
                      </GlassSurface>
                    </button>
                  </Magnet>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="text-muted-foreground inline-flex min-h-11 items-center gap-2 px-2 text-sm"
                      aria-label={`Choose a teacher, currently ${persona.display_name}`}
                    >
                      With {persona.display_name}
                      <ChevronDown size={14} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-80 min-w-60 overflow-y-auto">
                      {personas.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => onSelectPersona(p.id)}
                          className="min-h-11 justify-between"
                        >
                          <span>{p.display_name}</span>
                          {persona.id === p.id && <Check size={15} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {course && (
                <div
                  className="border-border mt-5 flex gap-1 border-t pt-5"
                  role="group"
                  aria-label="Conversation mode"
                >
                  {(['course', 'free'] as const).map((value) => (
                    <button
                      key={value}
                      disabled={busy}
                      onClick={() => onSelectMode(value)}
                      aria-pressed={mode === value}
                      className={`min-h-11 rounded-full px-4 text-sm ${mode === value ? 'text-foreground bg-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {value === 'course' ? 'Follow my course' : 'Just talk'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </LiquidGlass>
        </div>
      </section>
      <section id="courses" aria-labelledby="courses-title" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 id="courses-title" className="text-xl font-semibold">
            Courses
          </h2>
          <div className="relative w-full sm:w-56">
            <Search
              size={16}
              className="text-muted-foreground pointer-events-none absolute top-3.5 left-3"
            />
            <input
              aria-label="Find a course"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a course"
              className="field pl-9"
            />
          </div>
        </div>
        {library.error ? (
          <p role="alert" className="text-muted-foreground py-8 text-sm">
            {library.error}
          </p>
        ) : filtered.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => {
              const pos = coursePosition(item);
              const active = item.id === library.selectedId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectCourse(item.id)}
                  disabled={busy || !item.units.length}
                  aria-pressed={active}
                  className={`flex min-w-0 items-center gap-4 rounded-2xl border p-5 text-left backdrop-blur-xl transition-colors disabled:cursor-wait ${active ? 'border-white/40 bg-black/90' : 'border-white/15 bg-black/85 hover:border-white/30 hover:bg-black/90'}`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground bg-white/5'}`}
                  >
                    <BookOpen size={21} strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{item.title}</span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {item.started
                        ? `${pos.completed} of ${pos.total} sessions`
                        : `${item.units.length} lessons`}
                    </span>
                    {item.started && (
                      <progress
                        className="study-progress mt-3 w-full"
                        max={pos.total || 1}
                        value={pos.completed}
                        aria-label={`${item.title} progress`}
                      />
                    )}
                  </span>
                  {active ? (
                    <Check size={17} className="text-primary shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-2xl bg-black/85 p-8 text-center text-sm backdrop-blur-xl">
            {query
              ? 'No matching courses. Try another name.'
              : 'Courses are not available yet. You can still talk with your teacher.'}
          </p>
        )}
      </section>
      <p className="mt-10 text-center font-mono text-xs text-white/40">
        {persona.display_name} is an AI teacher.
      </p>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <ColorBends
          colors={['#00ff1e', '#2c7be2', '#501b35']}
          rotation={0}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={0.95}
          mouseInfluence={1}
          parallax={0.5}
          noise={0.1}
          transparent
          autoRotate={0}
        />
      </div>
    </div>
  );
};
