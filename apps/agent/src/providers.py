"""Which speech-to-speech model voices the teacher, and how it takes turns.

Speech-to-speech, not a speech-to-text -> LLM -> text-to-speech chain: the
model hears HOW the student sounds and can answer with vocal expression.
OpenAI Realtime is the default, using a server key or the student's own key.

    REALTIME_PROVIDER      openai (default) | xai
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
from speech_speed import SpeechRealtimeModel, SpeechSpeed
from xai_realtime import RealtimeModel as XaiRealtimeModel

PROVIDERS = ("xai", "openai")
DEFAULT_VOICES = {"xai": "Ara", "openai": "marin"}
XAI_REALTIME_URL = "wss://api.x.ai/v1/realtime"

XAI_MODEL = "grok-voice-3.0"
OPENAI_MODEL = "gpt-realtime-2.1"

# Learners pause mid-sentence to find a word, beginners for 600-900 ms and
# more. The plugin's default (200 ms of silence ends the turn) has the teacher
# talking over them; 1100 ms gives a beginner room to think, and an adult who
# speaks fluently gets a quicker 750 ms.
BEGINNER_TURN_SILENCE_MS = 1100
FLUENT_TURN_SILENCE_MS = 750


def default_provider() -> str:
    provider = (os.getenv("REALTIME_PROVIDER") or "openai").strip().lower()
    return provider if provider in PROVIDERS else "openai"


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
    speech_speed: SpeechSpeed | None = None,
):
    voice = voice_for(persona, provider)
    if provider == "openai":
        model_id = (os.getenv("OPENAI_REALTIME_MODEL") or OPENAI_MODEL).removeprefix(
            "openai/"
        )
        # Wait for a learner's thought, including pauses to find a word.
        turn_detection = SemanticVad(
            type="semantic_vad",
            eagerness="low",
            create_response=True,
            interrupt_response=True,
        )
        model_class = (
            SpeechRealtimeModel if speech_speed else openai.realtime.RealtimeModel
        )
        return model_class(
            **({"speech_speed": speech_speed} if speech_speed else {}),
            model=model_id,
            voice=voice,
            api_key=api_key,
            turn_detection=turn_detection,
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
