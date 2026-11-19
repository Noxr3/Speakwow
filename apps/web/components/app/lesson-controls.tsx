'use client';

import { useState } from 'react';
import { Ellipsis, MessageCircle, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useDataChannel } from '@livekit/components-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LessonControls({ connected }: { connected: boolean }) {
  const [phase, setPhase] = useState('welcome');
  const [topic, setTopic] = useState('');
  const { send } = useDataChannel('speakwow.study.action');
  useDataChannel('speakwow.study', ({ payload }) => {
    try {
      const update = JSON.parse(new TextDecoder().decode(payload));
      if (
        ['welcome', 'teaching', 'assessing', 'between', 'chat', 'break', 'complete'].includes(
          update.phase
        )
      ) {
        setPhase(update.phase);
        setTopic(typeof update.title === 'string' ? update.title : '');
      }
    } catch {
      /* Ignore malformed state updates. */
    }
  });

  async function change(action: 'start' | 'resume' | 'chat' | 'pause') {
    try {
      await send(new TextEncoder().encode(JSON.stringify({ action })), { reliable: true });
    } catch {
      toast.error('Could not reach your teacher. Please try again.');
    }
  }

  if (phase === 'assessing' || phase === 'complete') return null;
  const canChat = phase !== 'chat';
  return (
    <>
      {phase !== 'teaching' && (
        <button
          type="button"
          disabled={!connected}
          onClick={() => change(phase === 'welcome' ? 'start' : 'resume')}
          className="text-primary hover:bg-accent inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium"
        >
          <Play size={16} />
          {phase === 'welcome'
            ? 'Begin lesson'
            : phase === 'between'
              ? 'Next lesson'
              : 'Resume lesson'}
        </button>
      )}
      {canChat && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!connected}
              aria-label="Classroom options"
              className="text-muted-foreground hover:bg-accent focus-visible:ring-primary inline-flex size-11 items-center justify-center rounded-full focus-visible:ring-2"
            >
              <Ellipsis size={20} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            collisionPadding={12}
            className="max-w-[min(18rem,90vw)]"
          >
            {topic && <DropdownMenuLabel>{topic}</DropdownMenuLabel>}
            {phase === 'teaching' && (
              <DropdownMenuItem onSelect={() => void change('pause')} className="min-h-11">
                <Pause /> Take a break
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void change('chat')} className="min-h-11">
              <MessageCircle /> Just chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
