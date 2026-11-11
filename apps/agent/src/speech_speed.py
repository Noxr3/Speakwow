"""One speed state shared by the student, teacher tool and OpenAI session.

Use the plugin's public raw-event hooks to wait for response.done and for
session.updated. Changing browser playbackRate does not control a WebRTC voice.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import math
from collections.abc import Callable
from uuid import uuid4

from livekit import rtc
from livekit.agents import function_tool
from livekit.plugins.openai.realtime import RealtimeModel

ATTRIBUTE = "speakwow.speech"
RPC_METHOD = "speakwow.set_speech"


def valid_speed(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and 0.5 <= value <= 1.5


def normalize_preferences(value) -> tuple[float, bool]:
    value = value if isinstance(value, dict) else {}
    speed = value.get("speed", 1.0)
    adaptive = value.get("adaptive", True)
    return (
        round(float(speed), 2) if valid_speed(speed) else 1.0,
        adaptive if isinstance(adaptive, bool) else True,
    )


class SpeechSpeed:
    def __init__(self, speed=1.0, adaptive=True, *, supported=True):
        self.speed, self.adaptive = normalize_preferences(
            {"speed": speed, "adaptive": adaptive}
        )
        self.supported = supported
        self.applied: float | None = None
        self.source = "student"
        self.revision = 0
        self.error: str | None = None
        self.active = False
        self.in_flight: tuple[str, float] | None = None
        self.send: Callable | None = None
        self.on_change: Callable = lambda: None
        self.on_confirmed: Callable = lambda speed: None
        self._timer: asyncio.TimerHandle | None = None

    def state(self):
        return {
            "speed": self.speed,
            "adaptive": self.adaptive,
            "appliedSpeed": self.applied,
            "pending": self.supported
            and (self.applied != self.speed or self.in_flight is not None),
            "supported": self.supported,
            "source": self.source,
            "revision": self.revision,
            "error": self.error,
        }

    def note(self):
        return (
            f"Speech speed is set to {self.speed:g}x; automatic adjustment is "
            f"{'enabled' if self.adaptive else 'disabled'}. "
            "Use set_speech_speed when the student asks to speak slower/faster or return to normal (1.0). "
            "When automatic adjustment is enabled, you may make small changes (about 0.1) for a "
            "difficult explanation or listening practice. Respect their latest manual choice; "
            "do not keep changing it or speed up a struggling learner. When automatic adjustment "
            "is disabled, change speed only for an explicit spoken request. "
            "Slow delivery still has natural stress, connected phrases and warmth, never a flat "
            "robotic or syllable-by-syllable reading. Use shorter phrases and clear pauses when "
            "they need help. Do not change the learning objective or give exam hints. "
            "The speed tool affects subsequent audio, never audio already spoken. "
            "If it fails, do not claim the setting changed. Acknowledge explicit requests briefly, "
            "then continue the conversation; do not announce every automatic adjustment."
        )

    def _notify(self):
        self.revision += 1
        self.on_change()

    def change(self, speed, *, source, adaptive=None):
        if not self.supported:
            raise ValueError("Speed adjustment is available with OpenAI voice.")
        if not valid_speed(speed) or (
            adaptive is not None and type(adaptive) is not bool
        ):
            raise ValueError("Choose a speed between 0.5 and 1.5.")
        self.speed = round(float(speed), 2)
        self.source = source
        if adaptive is not None:
            self.adaptive = adaptive
        self.error = None
        self._flush()
        self._notify()

    def _flush(self):
        if not self.send or self.active or self.in_flight or self.applied == self.speed:
            return
        event_id = f"speech_speed_{uuid4().hex}"
        self.in_flight = (event_id, self.speed)
        self.send(
            {
                "type": "session.update",
                "event_id": event_id,
                "session": {
                    "type": "realtime",
                    "audio": {"output": {"speed": self.speed}},
                },
            }
        )
        with contextlib.suppress(RuntimeError):
            self._timer = asyncio.get_running_loop().call_later(8, self._failed)

    def _failed(self):
        self.close_timer()
        self.in_flight = None
        self.speed = self.applied if self.applied is not None else 1.0
        self.error = "Could not change speech speed. Please try again."
        self._notify()

    def close_timer(self):
        if self._timer:
            self._timer.cancel()
            self._timer = None

    def on_event(self, event):
        kind = event.get("type")
        if kind == "session.created":
            # A reconnect can happen before response.done or an update ack.
            self.active = False
            self.close_timer()
            self.in_flight = None
        if kind == "response.created":
            self.active = True
        elif kind == "response.done":
            self.active = False
            self._flush()
        elif kind in ("session.created", "session.updated"):
            speed = (
                event.get("session", {}).get("audio", {}).get("output", {}).get("speed")
            )
            if not valid_speed(speed):
                return
            self.applied = float(speed)
            self.on_confirmed(self.applied)
            if self.in_flight and self.in_flight[1] == self.applied:
                self.close_timer()
                self.in_flight = None
            self._flush()
            self._notify()
        elif (
            kind == "error"
            and self.in_flight
            and event.get("error", {}).get("event_id") == self.in_flight[0]
        ):
            self._failed()


class SpeechRealtimeModel(RealtimeModel):
    def __init__(self, *, speech_speed: SpeechSpeed, **kwargs):
        self.speech_speed = speech_speed
        super().__init__(speed=speech_speed.speed, **kwargs)

    def session(self):
        session = super().session()
        self.speech_speed.send = lambda event: session.send_event(event)
        # The pinned 1.3 plugin uses _opts to recreate a WebSocket after a
        # reconnect. Keep its snapshot at the last provider-confirmed speed.
        self.speech_speed.on_confirmed = lambda speed: setattr(
            self._opts, "speed", speed
        )
        session.on("openai_server_event_received", self.speech_speed.on_event)
        return session


def make_speed_tool(control: SpeechSpeed):
    @function_tool
    async def set_speech_speed(speed: float, requested_by_student: bool = False) -> str:
        """Adjust your speaking speed for subsequent replies, from 0.5 to 1.5 (normal 1.0).

        Use for requests like 'slow down', '慢一点', 'faster', or 'normal speed'.
        Set requested_by_student true ONLY for an explicit student request.
        Otherwise adapt gently for comprehension/practice only if automatic adjustment is enabled.
        A pending result means queued for the next response, not applied to existing audio.
        """
        if not control.adaptive and not requested_by_student:
            return "Automatic adjustment is disabled. Keep the student's chosen speed."
        if (
            not requested_by_student
            and control.source == "student"
            and control.state()["pending"]
        ):
            return "The student's speed change is still pending. Keep their choice."
        try:
            control.change(
                speed, source="student" if requested_by_student else "teacher"
            )
        except ValueError as error:
            return str(error)
        return json.dumps(control.state())

    return set_speech_speed


def speed_rpc(control: SpeechSpeed, identity: str | None):
    async def handle(data):
        if not identity or data.caller_identity != identity:
            raise rtc.RpcError(
                1403, "Only this lesson's student can change speech speed."
            )
        try:
            value = json.loads(data.payload)
            if not isinstance(value, dict) or type(value.get("adaptive")) is not bool:
                raise ValueError("Invalid speech settings.")
            control.change(
                value.get("speed"), adaptive=value["adaptive"], source="student"
            )
        except (ValueError, TypeError) as error:
            raise rtc.RpcError(1400, str(error)) from error
        return json.dumps(control.state())

    return handle
