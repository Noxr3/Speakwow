'use client';

import type { ReactNode } from 'react';
import { ChevronDown, MessageCircle, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useDataChannel } from '@livekit/components-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statuses = {
  welcome: 'Ready to start',
  teaching: 'In progress',
  assessing: 'Checking your work',
  between: 'Lesson complete',
  break: 'On a break',
  chat: 'Chatting',
  complete: 'Finished',
};

function readStudy(raw?: string) {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!state || !Object.hasOwn(statuses, state.phase) || typeof state.attempt !== 'string')
      return null;
    return {
      phase: state.phase as keyof typeof statuses,
      attempt: state.attempt as string,
      title: typeof state.title === 'string' ? state.title : '',
      exam: state.kind === 'exam',
      awaitingStart: state.awaitingStart === true,
    };
  } catch {
    return null;
  }
}

export function LessonControls({ raw, children }: { raw?: string; children: ReactNode }) {
  const { send } = useDataChannel('speakwow.study.action');
  const study = readStudy(raw);
  if (!study) return <>{children}</>;
  const { phase, attempt, awaitingStart, exam } = study;
  const canChange = phase !== 'complete' && phase !== 'assessing';

  async function change(action: 'start' | 'resume' | 'chat' | 'pause') {
    try {
      await send(new TextEncoder().encode(JSON.stringify({ action, phase, attempt })), {
        reliable: true,
      });
    } catch {
      toast.error('Could not reach your teacher. Please try again.');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Classroom options, ${statuses[phase]}`}
          className="focus-visible:ring-primary pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-1 focus-visible:ring-2"
        >
          {children}
          <ChevronDown size={14} aria-hidden="true" className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={12}
        className="z-[100] max-w-[min(18rem,90vw)]"
      >
        <DropdownMenuLabel>
          {study.title && <span className="block">{study.title}</span>}
          <span className="text-muted-foreground">{statuses[phase]}</span>
        </DropdownMenuLabel>
        {canChange && phase !== 'teaching' && (
          <DropdownMenuItem onSelect={() => void change(awaitingStart ? 'start' : 'resume')}>
            <Play />{' '}
            {awaitingStart
              ? exam
                ? 'Start assessment'
                : phase === 'welcome'
                  ? 'Start lesson'
                  : 'Start next lesson'
              : 'Resume lesson'}
          </DropdownMenuItem>
        )}
        {canChange && phase !== 'break' && (
          <DropdownMenuItem onSelect={() => void change('pause')}>
            <Pause /> Take a break
          </DropdownMenuItem>
        )}
        {canChange && phase !== 'chat' && (
          <DropdownMenuItem onSelect={() => void change('chat')}>
            <MessageCircle /> Just chat
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
