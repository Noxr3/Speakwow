"""Offline regressions for xAI's cumulative input transcription events."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from livekit import rtc
from livekit.agents import llm, utils
from livekit.agents.voice.events import UserInputTranscribedEvent
from livekit.agents.voice.room_io._output import _ParticipantStreamTranscriptionOutput
from livekit.agents.voice.room_io.room_io import RoomIO
from livekit.plugins.xai.realtime.realtime_model import RealtimeSession as XaiSession
from openai.types.realtime import ConversationItemInputAudioTranscriptionCompletedEvent

from personas import load_personas
from providers import build_realtime_model


@pytest.fixture
def session(monkeypatch):
    # Exercise the model's session factory and actual event handler without a socket.
    def init(self, model):
        rtc.EventEmitter.__init__(self)
        self.items = {}
        self._remote_chat_ctx = SimpleNamespace(get=self.items.get)

    monkeypatch.setattr(XaiSession, "__init__", init)
    model = build_realtime_model(
        load_personas()["grace"], "xai", api_key="offline-test-key"
    )
    session = model.session()
    assert session in model._sessions
    return session


def transcribe(session, text, *, item_id="utterance-1", status="completed"):
    payload = {
        "type": "conversation.item.input_audio_transcription.completed",
        "event_id": "test-event",
        "item_id": item_id,
        "content_index": 0,
        "transcript": text,
    }
    if status is not None:
        payload["status"] = status
    # The pinned SDK constructs this same OpenAI event from the xAI payload.
    event = ConversationItemInputAudioTranscriptionCompletedEvent.model_construct(
        **payload
    )
    session._handle_conversion_item_input_audio_transcription_completed(event)


def test_growing_caption_is_one_final_user_turn(session):
    events = []
    session.on("input_audio_transcription_completed", events.append)
    for text in ["Add", "Add to you.", "Add to you. Add", "Add to you. Add to you."]:
        transcribe(session, text, status="in_progress")
    transcribe(session, "Add to you. Add to you.")

    assert [event.is_final for event in events] == [False, False, False, False, True]
    assert events[-1].transcript == "Add to you. Add to you."


def test_duplicate_final_and_late_interim_do_not_reopen_caption(session):
    events = []
    session.on("input_audio_transcription_completed", events.append)
    transcribe(session, "Hello.")
    transcribe(session, "Hello.")
    transcribe(session, "Hel", status="in_progress")

    assert len(events) == 1
    assert events[0].is_final


def test_separate_utterances_with_identical_words_are_preserved(session):
    events = []
    session.on("input_audio_transcription_completed", events.append)
    transcribe(session, "Hello.", item_id="first")
    transcribe(session, "Hello.", item_id="second")

    assert [event.item_id for event in events] == ["first", "second"]
    assert all(event.is_final for event in events)


@pytest.mark.parametrize("status", ["completed", None])
def test_final_replaces_remote_text_and_legacy_events_still_work(session, status):
    events = []
    session.on("input_audio_transcription_completed", events.append)
    message = llm.ChatMessage(role="user", content=["old partial"])
    session.items["utterance-1"] = SimpleNamespace(item=message)

    transcribe(session, "new partial", status="in_progress")
    assert message.content == ["old partial"]
    transcribe(session, "Final sentence.", status=status)

    assert message.content == ["Final sentence."]
    assert [event.is_final for event in events] == [False, True]


@pytest.mark.asyncio
async def test_caption_streams_keep_one_segment_until_final(session):
    streams = []

    async def stream_text(**kwargs):
        writer = SimpleNamespace(write=AsyncMock(), aclose=AsyncMock())
        streams.append((kwargs["attributes"], writer))
        return writer

    room = SimpleNamespace(
        on=Mock(),
        isconnected=lambda: True,
        remote_participants={},
        local_participant=SimpleNamespace(identity="agent", stream_text=stream_text),
    )
    output = _ParticipantStreamTranscriptionOutput(
        room, is_delta_stream=False, participant="user"
    )
    channel = utils.aio.Chan()
    session.on(
        "input_audio_transcription_completed",
        lambda event: channel.send_nowait(
            UserInputTranscribedEvent(
                transcript=event.transcript, is_final=event.is_final
            )
        ),
    )
    transcribe(session, "Add", status="in_progress")
    transcribe(session, "Add to you.", status="in_progress")
    transcribe(session, "Add to you.")
    transcribe(session, "Add to you.")
    channel.close()

    # Exercise the locked SDK's forwarding and text-stream publisher, not a UI mock.
    await RoomIO._forward_user_transcript(
        SimpleNamespace(_user_tr_output=output), channel
    )
    await output._flush_atask

    assert len({attrs["lk.segment_id"] for attrs, _ in streams}) == 1
    assert sum(attrs["lk.transcription_final"] == "true" for attrs, _ in streams) == 1
    streams[-1][1].write.assert_awaited_once_with("Add to you.")
