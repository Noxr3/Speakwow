import asyncio
import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from livekit import rtc

from speech_speed import SpeechSpeed, make_speed_tool, normalize_preferences, speed_rpc


def control(speed=1.0, adaptive=True):
    result = SpeechSpeed(speed, adaptive)
    sent = []
    result.send = sent.append
    result.on_event(
        {"type": "session.updated", "session": {"audio": {"output": {"speed": speed}}}}
    )
    return result, sent


def ack(c, speed):
    c.on_event(
        {"type": "session.updated", "session": {"audio": {"output": {"speed": speed}}}}
    )


def test_preferences_are_bounded_and_do_not_coerce_untrusted_values():
    assert normalize_preferences({"speed": 0.8, "adaptive": False}) == (0.8, False)
    for speed in [True, "0.8", None, float("nan"), 0.1, 2]:
        assert normalize_preferences({"speed": speed, "adaptive": "false"}) == (
            1.0,
            True,
        )


def test_speed_waits_for_current_response_and_server_ack():
    c, sent = control()
    c.on_event({"type": "response.created"})
    c.change(0.8, source="student")
    assert sent == []
    assert c.state()["appliedSpeed"] == 1
    assert c.state()["pending"]
    c.on_event({"type": "response.done"})
    assert sent[-1]["session"]["audio"]["output"]["speed"] == 0.8
    assert c.state()["pending"]
    ack(c, 0.8)
    assert not c.state()["pending"]
    assert c.state()["appliedSpeed"] == 0.8


def test_latest_student_choice_wins_while_update_is_in_flight():
    c, sent = control()
    c.change(0.8, source="student")
    c.change(1.2, source="student")
    assert len(sent) == 1
    ack(c, 0.8)
    assert len(sent) == 2
    assert sent[-1]["session"]["audio"]["output"]["speed"] == 1.2
    ack(c, 1.2)
    assert c.state()["speed"] == c.state()["appliedSpeed"] == 1.2


def test_provider_rejection_restores_confirmed_speed_without_retry_loop():
    c, sent = control()
    c.change(0.7, source="student")
    c.on_event({"type": "error", "error": {"event_id": sent[-1]["event_id"]}})
    assert c.state()["speed"] == 1
    assert c.state()["error"]
    assert not c.state()["pending"]
    assert len(sent) == 1


def test_other_provider_errors_do_not_reset_speed():
    c, _sent = control()
    c.change(0.7, source="student")
    c.on_event({"type": "error", "error": {"event_id": "unrelated"}})
    assert c.state()["speed"] == 0.7 and c.state()["pending"]


def test_reconnect_flushes_choice_even_if_previous_response_never_finished():
    c, sent = control()
    c.on_event({"type": "response.created"})
    c.change(0.75, source="student")
    c.on_event(
        {"type": "session.created", "session": {"audio": {"output": {"speed": 1}}}}
    )
    assert sent[-1]["session"]["audio"]["output"]["speed"] == 0.75
    ack(c, 0.75)
    assert not c.state()["pending"]


def test_return_to_original_speed_remains_pending_until_wire_updates_settle():
    c, _sent = control()
    c.change(0.75, source="student")
    c.change(1.0, source="student")
    assert c.state()["pending"]
    ack(c, 0.75)
    assert c.state()["pending"]
    ack(c, 1)
    assert not c.state()["pending"]


def test_timeout_rolls_back_to_last_confirmed_speed():
    c, _sent = control()
    c.change(0.75, source="student")
    c._failed()
    assert c.state()["speed"] == 1 and c.state()["error"]


async def test_auto_change_cannot_replace_pending_student_request():
    c, sent = control()
    c.change(0.75, source="student")
    await make_speed_tool(c)(1.1, requested_by_student=False)
    assert c.state()["speed"] == 0.75 and len(sent) == 1


async def test_speech_instructions_survive_coaching_and_course_recomposition():
    from personas import load_personas
    from teacher import Teacher

    teacher = Teacher(load_personas()["frank"])
    c, _sent = control(0.85, False)
    await teacher.set_speech_note(c.note())
    await teacher.set_coaching_note("Ask a short question.")
    await teacher.set_phase_note("A new lesson.")
    assert "0.85x" in teacher.with_note("Continue.")
    assert "automatic adjustment is disabled" in teacher.instructions
    assert "natural stress" in teacher.instructions


def test_signed_job_metadata_contains_initial_speed_and_rpc_caller():
    from agent import parse_job_metadata

    job = parse_job_metadata(
        json.dumps(
            {
                "speech": {"speed": 0.8, "adaptive": False},
                "participant_identity": "guest_signed",
            }
        )
    )
    assert (job.speech_speed, job.adaptive_speed, job.participant_identity) == (
        0.8,
        False,
        "guest_signed",
    )
    job = parse_job_metadata('{"speech":{"speed":true}}')
    assert job.speech_speed == 1 and job.adaptive_speed


async def test_rpc_registration_connects_before_accessing_local_participant():
    from speech_speed import register_speed_rpc

    calls = []
    connected = False

    class Room:
        @property
        def local_participant(self):
            assert connected, "cannot access local participant before connecting"
            return SimpleNamespace(
                register_rpc_method=lambda name, handler: calls.append(name)
            )

    async def connect():
        nonlocal connected
        await asyncio.sleep(0)
        connected = True
        calls.append("connected")

    ctx = SimpleNamespace(room=Room(), connect=connect)
    c, _sent = control()
    await register_speed_rpc(ctx, c, "student")
    assert calls == ["connected", "speakwow.set_speech"]


async def test_tool_respects_auto_off_but_accepts_explicit_spoken_request():
    c, sent = control(adaptive=False)
    tool = make_speed_tool(c)
    result = await tool(0.8, requested_by_student=False)
    assert "disabled" in result.lower() and not sent
    result = await tool(0.8, requested_by_student=True)
    assert json.loads(result)["speed"] == 0.8 and sent


async def test_teacher_can_adapt_and_ui_observes_the_same_state():
    c, _sent = control()
    changes = []
    c.on_change = lambda: changes.append(c.state())
    await make_speed_tool(c)(0.85, requested_by_student=False)
    ack(c, 0.85)
    assert changes[-1]["source"] == "teacher"
    assert changes[-1]["appliedSpeed"] == 0.85
    assert "0.85" in c.note()


async def test_only_the_signed_participant_can_control_speed():
    c, sent = control()
    handler = speed_rpc(c, "guest_signed")
    with pytest.raises(rtc.RpcError):
        await handler(
            SimpleNamespace(
                caller_identity="guest_other", payload='{"speed":0.8,"adaptive":true}'
            )
        )
    assert not sent
    result = await handler(
        SimpleNamespace(
            caller_identity="guest_signed", payload='{"speed":0.8,"adaptive":true}'
        )
    )
    assert json.loads(result)["speed"] == 0.8


@pytest.mark.parametrize(
    "payload",
    [
        "null",
        "[]",
        "{}",
        '{"speed":2,"adaptive":true}',
        '{"speed":true,"adaptive":true}',
        '{"speed":0.8,"adaptive":"true"}',
    ],
)
async def test_rpc_rejects_invalid_preferences(payload):
    c, sent = control()
    with pytest.raises(rtc.RpcError):
        await speed_rpc(c, "student")(
            SimpleNamespace(caller_identity="student", payload=payload)
        )
    assert not sent


async def test_openai_adapter_sends_real_session_update_without_restarting(monkeypatch):
    from livekit.plugins.openai.realtime.realtime_model import RealtimeSession

    from personas import load_personas
    from providers import build_realtime_model

    monkeypatch.setattr(RealtimeSession, "_main_task", AsyncMock())
    c = SpeechSpeed(0.9, True)
    model = build_realtime_model(
        load_personas()["frank"], "openai", api_key="test", speech_speed=c
    )
    session = model.session()
    queued = []
    # Inspect the actual SDK's outbound channel; no network or microphone.
    session.send_event = queued.append
    session.emit(
        "openai_server_event_received",
        {"type": "session.updated", "session": {"audio": {"output": {"speed": 0.9}}}},
    )
    c.change(1.1, source="student")
    assert queued[-1]["session"]["audio"]["output"]["speed"] == 1.1
    await session.aclose()
    await model.aclose()


@pytest.mark.live
async def test_live_openai_acknowledges_initial_and_changed_speed():
    """Optional wire smoke test; uses no microphone, student data or generated audio."""
    from dotenv import load_dotenv

    from personas import load_personas
    from providers import build_realtime_model

    load_dotenv(".env.local")
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY is not configured locally")
    c = SpeechSpeed(0.9)
    model = build_realtime_model(load_personas()["frank"], "openai", speech_speed=c)
    ready = asyncio.Event()
    c.on_change = (
        lambda: ready.set()
        if c.applied == c.speed and not c.state()["pending"]
        else None
    )
    try:
        session = model.session()
        await asyncio.wait_for(ready.wait(), 15)
        ready.clear()
        c.change(0.75, source="student")
        await asyncio.wait_for(ready.wait(), 15)
        assert c.applied == 0.75 and not c.error
        await session.aclose()
    finally:
        c.close_timer()
        await model.aclose()
