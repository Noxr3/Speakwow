"""Which speech-to-speech model voices the teacher, and how it takes turns.

Speech-to-speech, not a speech-to-text -> LLM -> text-to-speech chain: the
model hears HOW the student sounds (hesitant, excited, tired) and answers
with emotion in its own voice, with the lowest delay. As of 2026-10 Grok
Voice 3.0 leads the Artificial Analysis speech-to-speech index (time to
first audio 0.81 s), so xAI is the default.

    REALTIME_PROVIDER      xai (default) | openai
    XAI_REALTIME_MODEL     default grok-voice-3.0 (pinned: grok-voice-latest moves
                           to each new generation, and a teacher should not change
                           voice or manner overnight)
    OPENAI_REALTIME_MODEL  default gpt-realtime-2.1
    TURN_SILENCE_MS        xAI end-of-turn silence for everyone; unset, it is
                           1100 ms for beginners and school students, 750 ms for
                           B1+ adults
    XAI_API_KEY / OPENAI_API_KEY   the operator's keys, used when the student
                                   did not bring their own

Each persona card names a voice per provider (`voices`), so a teacher keeps
their character whichever model speaks for them.
"""

from __future__ import annotations

import os

from livekit.plugins import openai
from openai.types.realtime.realtime_audio_input_turn_detection import (
    SemanticVad,
    ServerVad,
)

from personas import Persona
from xai_realtime import RealtimeModel as XaiRealtimeModel

PROVIDERS = ("xai", "openai")
DEFAULT_VOICES = {"xai": "Ara", "openai": "marin"}
XAI_REALTIME_URL = "wss://api.x.ai/v1/realtime"

XAI_MODEL = "grok-voice-3.0"

# Learners pause mid-sentence to find a word, beginners for 600-900 ms and
# more. The plugin's default (200 ms of silence ends the turn) has the teacher
# talking over them; 1100 ms gives a beginner room to think, and an adult who
# speaks fluently gets a quicker 750 ms.
BEGINNER_TURN_SILENCE_MS = 1100
FLUENT_TURN_SILENCE_MS = 750


def default_provider() -> str:
    provider = (os.getenv("REALTIME_PROVIDER") or "xai").strip().lower()
    return provider if provider in PROVIDERS else "xai"


def voice_for(persona: Persona, provider: str) -> str:
    return persona.voices.get(provider) or DEFAULT_VOICES[provider]


def turn_silence_ms(beginner: bool = True) -> int:
    default = BEGINNER_TURN_SILENCE_MS if beginner else FLUENT_TURN_SILENCE_MS
    try:
        return max(200, min(2000, int(os.getenv("TURN_SILENCE_MS") or default)))
    except ValueError:
        return default


def build_realtime_model(
    persona: Persona,
    provider: str,
    api_key: str | None = None,
    beginner: bool = True,
):
    voice = voice_for(persona, provider)
    if provider == "openai":
        return openai.realtime.RealtimeModel(
            model=os.getenv("OPENAI_REALTIME_MODEL") or "gpt-realtime-2.1",
            voice=voice,
            api_key=api_key,
            # Semantic VAD judges whether the sentence is finished, not just
            # whether it went quiet; "low" waits for a learner who is thinking.
            turn_detection=SemanticVad(
                type="semantic_vad",
                eagerness="low",
                create_response=True,
                interrupt_response=True,
            ),
        )
    model_id = os.getenv("XAI_REALTIME_MODEL") or XAI_MODEL
    model = XaiRealtimeModel(
        voice=voice,
        api_key=api_key,
        base_url=f"{XAI_REALTIME_URL}?model={model_id}",
        turn_detection=ServerVad(
            type="server_vad",
            threshold=0.5,
            prefix_padding_ms=300,
            silence_duration_ms=turn_silence_ms(beginner),
            create_response=True,
            interrupt_response=True,
        ),
    )
    # livekit-plugins-xai 1.3 pins an older model id in session.update; keep it
    # in step with the URL. tests/test_providers.py checks both.
    model._opts.model = model_id
    return model
