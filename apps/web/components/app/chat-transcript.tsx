'use client';

import { type ReceivedMessage, useAgent } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';

export function ChatTranscript({ messages }: { messages: ReceivedMessage[] }) {
  const { state } = useAgent();
  return (
    <section
      aria-label="Transcript"
      className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col"
    >
      <AgentChatTranscript
        agentState={state}
        messages={messages}
        className="min-h-0 [&_.is-user>div]:rounded-[22px]"
      />
    </section>
  );
}
