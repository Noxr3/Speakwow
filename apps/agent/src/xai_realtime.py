"""Transcription compatibility for the locked LiveKit xAI 1.3.12 plugin.

xAI sends cumulative interim transcripts on the ``completed`` event channel.
The pinned plugin inherits OpenAI's handler, which treats every event as final.
Keep this adapter until upgrading to a version with the upstream fix:
https://github.com/livekit/agents/issues/6271
"""

from livekit.agents import llm
from livekit.plugins.xai.realtime.realtime_model import (
    RealtimeModel as XaiRealtimeModel,
)
from livekit.plugins.xai.realtime.realtime_model import (
    RealtimeSession as XaiRealtimeSession,
)
from openai.types.realtime import ConversationItemInputAudioTranscriptionCompletedEvent


class RealtimeSession(XaiRealtimeSession):
    def __init__(self, realtime_model: XaiRealtimeModel) -> None:
        self._finalized_transcription_ids: set[str] = set()
        super().__init__(realtime_model)

    def _handle_conversion_item_input_audio_transcription_completed(
        self, event: ConversationItemInputAudioTranscriptionCompletedEvent
    ) -> None:
        # Deduplicate by utterance identity, never by words: users can repeat themselves.
        if event.item_id in self._finalized_transcription_ids:
            return

        if getattr(event, "status", None) == "in_progress":
            self.emit(
                "input_audio_transcription_completed",
                llm.InputTranscriptionCompleted(
                    item_id=event.item_id,
                    transcript=event.transcript,
                    is_final=False,
                ),
            )
            return

        # xAI may already have populated this item's text. The base handler appends
        # the final transcript, so replace prior text while retaining other content.
        remote_item = self._remote_chat_ctx.get(event.item_id)
        if remote_item and isinstance(remote_item.item, llm.ChatMessage):
            remote_item.item.content = [
                content
                for content in remote_item.item.content
                if not isinstance(content, str)
            ]

        self._finalized_transcription_ids.add(event.item_id)
        super()._handle_conversion_item_input_audio_transcription_completed(event)


class RealtimeModel(XaiRealtimeModel):
    def session(self) -> RealtimeSession:
        session = RealtimeSession(self)
        self._sessions.add(session)
        return session
