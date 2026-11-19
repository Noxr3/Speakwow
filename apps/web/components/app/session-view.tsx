'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { PersonaSummary } from '@speakwow/shared';
import type { AppConfig } from '@/app-config';
import DotGrid from '@/components/DotGrid';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { LessonControls } from '@/components/app/lesson-controls';
import { LiveOverlays } from '@/components/app/live-overlays';
import { SpeechSpeedMenu } from '@/components/app/speech-speed-menu';
import { StudySurface } from '@/components/app/study-surface';
import { TeacherAvatar } from '@/components/app/teacher-avatar';
import { TileLayout } from '@/components/app/tile-layout';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { cn } from '@/lib/shadcn/utils';
import type { CallMode } from '@/lib/token-source';
import { Shimmer } from '../ai-elements/shimmer';

const MotionBottom = motion.create('div');

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const SHIMMER_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
  persona: PersonaSummary;
  mode: CallMode;
}

export const SessionView = ({
  appConfig,
  persona,
  mode,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const { agent, state: teacherState } = useVoiceAssistant();
  const joining = teacherState === 'connecting' || teacherState === 'initializing';
  const teacherIdentity = (
    <>
      <TeacherAvatar id={persona.id} className="size-8" />
      <span className="text-foreground text-sm font-medium">{persona.display_name}</span>
    </>
  );

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsScreenShare,
  };

  return (
    <section
      {...props}
      className={cn(
        'relative z-10 grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden',
        chatOpen && 'bg-background',
        props.className
      )}
    >
      {!chatOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: -10,
            pointerEvents: 'none',
          }}
        >
          <DotGrid
            dotSize={5}
            gap={15}
            baseColor="#163c36"
            activeColor="#00d997"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      )}
      {!chatOpen && <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />}
      {/* Agent indicator: prominently identifies the current teacher
          so users with multiple tabs open never continue a session in the wrong context. */}
      <div className="pointer-events-none relative z-20 flex justify-center px-3 pt-[calc(max(1rem,env(safe-area-inset-top))+4rem)] pb-2">
        <LiquidGlass radius={999} width="auto">
          <div className="flex items-center gap-2.5 px-4 py-1.5">
            {mode === 'course' ? (
              <LessonControls
                raw={session.isConnected ? agent?.attributes['speakwow.study'] : undefined}
              >
                {teacherIdentity}
              </LessonControls>
            ) : (
              teacherIdentity
            )}
            {mode !== 'course' && (
              <span className="label-caption text-muted-foreground">Free talk</span>
            )}
            <SpeechSpeedMenu />
          </div>
        </LiquidGlass>
      </div>
      <div className="relative isolate flex min-h-0 flex-col overflow-hidden">
        <StudySurface transcriptOpen={chatOpen} onView={() => setChatOpen(false)} />
        <LiveOverlays transcriptOpen={chatOpen} onView={() => setChatOpen(false)} />
        {chatOpen ? <ChatTranscript messages={messages} /> : <TileLayout chatOpen={false} />}
      </div>
      <MotionBottom
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="relative z-50 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] md:px-12 md:pb-6"
      >
        {/* Pre-connect message */}
        {appConfig.isPreConnectBufferEnabled && (
          <AnimatePresence>
            {joining && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {persona.display_name} is joining…
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="relative mx-auto max-w-2xl">
          {!chatOpen && <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />}
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </MotionBottom>
    </section>
  );
};
