from livekit.plugins.openai.realtime.realtime_model import process_base_url

from personas import load_personas
from providers import build_realtime_model, default_provider, turn_silence_ms
from reflect import GATEWAY_MODEL, Reflector

FRANK = load_personas()["frank"]


def test_xai_uses_the_newest_voice_model_and_patient_turn_taking(monkeypatch) -> None:
    monkeypatch.delenv("XAI_REALTIME_MODEL", raising=False)
    monkeypatch.delenv("TURN_SILENCE_MS", raising=False)
    model = build_realtime_model(FRANK, "xai", api_key="k")
    assert model.model == "grok-voice-latest"
    url = process_base_url(model._opts.base_url, model.model)
    assert url == "wss://api.x.ai/v1/realtime?model=grok-voice-latest"
    assert model._opts.voice == "Rex"
    assert model._opts.turn_detection.silence_duration_ms == 700


def test_openai_uses_semantic_turn_detection(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_REALTIME_MODEL", raising=False)
    model = build_realtime_model(FRANK, "openai", api_key="k")
    assert model.model == "gpt-realtime-2.1"
    assert model._opts.voice == "cedar"
    assert model._opts.turn_detection.type == "semantic_vad"
    assert model._opts.turn_detection.eagerness == "low"


def test_env_overrides_are_bounded(monkeypatch) -> None:
    monkeypatch.setenv("REALTIME_PROVIDER", "OpenAI")
    assert default_provider() == "openai"
    monkeypatch.setenv("REALTIME_PROVIDER", "nope")
    assert default_provider() == "xai"
    monkeypatch.setenv("TURN_SILENCE_MS", "50")
    assert turn_silence_ms() == 200
    monkeypatch.setenv("TURN_SILENCE_MS", "abc")
    assert turn_silence_ms() == 700


def test_reflection_prefers_an_explicit_key_then_the_gateway_flash_model(
    monkeypatch,
) -> None:
    for name in ("MEMORY_LLM_API_KEY", "MEMORY_LLM_BASE_URL", "MEMORY_LLM_MODEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai")
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gw")
    r = Reflector.from_env()
    assert (r.api_key, r.model) == ("gw", GATEWAY_MODEL)
    assert r.base_url == "https://ai-gateway.vercel.sh/v1"
    monkeypatch.setenv("MEMORY_LLM_API_KEY", "mine")
    assert Reflector.from_env().api_key == "mine"
    monkeypatch.delenv("MEMORY_LLM_API_KEY")
    monkeypatch.delenv("AI_GATEWAY_API_KEY")
    assert Reflector.from_env().model == "gpt-4.1-mini"
