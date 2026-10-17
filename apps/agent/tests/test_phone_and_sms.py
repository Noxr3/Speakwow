import asyncio
import json

import httpx
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from agent import parse_job_metadata
from memory import SupabaseMemory
from personas import load_personas
from phone import caller_verified, message_channel, normalize_phone, phone_access
from reflect import Turn
from sms_server import (
    LIMIT,
    MEMORY,
    MODEL,
    PERSONAS,
    SENDER,
    TASKS,
    TOLD_TO_LINK,
    deliver,
    handle_sms,
    is_from_twilio,
    twilio_signature,
)
from teacher import build_instructions, render_snapshot
from texting import (
    LOST,
    NO_MEDIA,
    TOO_MANY,
    UNLINKED,
    answer_text,
    as_text,
    build_text_instructions,
)

TEACHERS = load_personas()
FRANK = TEACHERS["frank"]
STUDENT = "11111111-1111-4111-8111-111111111111"
PHONE = "+447700900001"


# ---------- numbers ----------


def test_numbers_become_e164_or_nothing() -> None:
    assert normalize_phone("+1 (555) 010-9999") == "+15550109999"
    assert normalize_phone("sip:+447700900001@trunk.example") == PHONE
    assert normalize_phone("tel:+8613800000000") == "+8613800000000"
    assert normalize_phone("0044 7700 900001") == PHONE
    assert normalize_phone("whatsapp:+447700900001") == PHONE
    assert message_channel("whatsapp:+447700900001") == "whatsapp"
    assert message_channel("+447700900001") == "sms"
    # without a country code a number is ambiguous
    assert normalize_phone("5550109999") is None
    for bad in (None, "", "+0123456", "+1234", "+1234567890123456"):
        assert normalize_phone(bad) is None


# ---------- calls ----------


def test_only_a_carrier_verified_caller_gets_their_memory() -> None:
    assert caller_verified({"sip.h.x-twilio-verstat": "TN-Validation-Passed-A"})
    assert caller_verified({"twilio.verstat": "TN-Validation-Passed-A"})
    for weak in (
        "TN-Validation-Passed-B",
        "No-TN-Validation",
        "TN-Validation-Failed-A",
    ):
        assert not caller_verified({"sip.h.x-twilio-verstat": weak})
    assert not caller_verified({"sip.phoneNumber": PHONE})

    assert phone_access(True, True, {}) == ("student", "verified")
    # a spoofed caller ID must not read out someone else's memory
    assert phone_access(False, True, {}) == ("guest", "unverified_caller_id")
    assert phone_access(False, True, {"PHONE_TRUST_UNVERIFIED": "on"})[0] == "student"
    assert phone_access(True, False, {}) == ("guest", "unlinked")
    no_guests = {"ALLOW_GUESTS": "false"}
    assert phone_access(False, True, no_guests) == ("refuse", "guests_not_allowed")
    assert phone_access(True, True, no_guests)[0] == "student"
    assert phone_access(True, True, {"REQUIRE_BYOK": "true"}) == (
        "refuse",
        "require_byok",
    )


def test_a_phone_call_is_marked_by_the_dispatch_rule() -> None:
    call = parse_job_metadata(json.dumps({"channel": "phone"}))
    assert call.channel == "phone" and not call.persona_given
    assert call.persona.id == "frank" and call.student_id is None
    picked = parse_job_metadata(json.dumps({"channel": "phone", "persona": "lily"}))
    assert picked.persona.id == "lily" and picked.persona_given
    assert parse_job_metadata(json.dumps({"channel": "fax"})).channel == "web"
    assert parse_job_metadata(None).channel == "web"


def test_a_phone_call_has_no_screen() -> None:
    web_call = build_instructions(
        FRANK, None, [{"id": "laugh", "emoji": "😂", "when": "x"}]
    )
    phone_call = build_instructions(
        FRANK, None, [{"id": "laugh", "emoji": "😂", "when": "x"}], channel="phone"
    )
    assert "show_widget" in web_call and "send_sticker" in web_call
    assert "show_widget" not in phone_call and "send_sticker" not in phone_call
    assert "on a phone call" in phone_call and "There is no screen" in phone_call


def test_a_call_sees_the_latest_texts() -> None:
    brief = render_snapshot(
        {
            "recent_texts": [
                {"role": "user", "content": "I won the match!"},
                {"role": "assistant", "content": "No way, well done!"},
            ]
        }
    )
    assert "Your latest text messages with them" in brief
    assert brief.index("They: I won the match!") < brief.index("You: No way")


# ---------- memory ----------


def _memory(handler) -> tuple[SupabaseMemory, list[httpx.Request]]:
    calls: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(record))
    return SupabaseMemory("http://db.local", "service-key", client), calls


async def test_memory_finds_a_student_by_number_and_reads_texts_oldest_first() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/student_phones"):
            return httpx.Response(
                200, json=[{"student_id": STUDENT, "sms_opted_out": False}]
            )
        return httpx.Response(
            200,
            json=[
                {"role": "assistant", "content": "Nice!", "created_at": "2"},
                {"role": "user", "content": "I won", "created_at": "1"},
            ],
        )

    memory, calls = _memory(handler)
    link = await memory.student_for_phone(PHONE)
    assert link == {"student_id": STUDENT, "sms_opted_out": False}
    assert calls[0].url.params["phone"] == f"eq.{PHONE}"
    texts = await memory.recent_texts(STUDENT)
    assert [t["content"] for t in texts] == ["I won", "Nice!"]
    params = calls[1].url.params
    assert params["sessions.channel"] == "in.(sms,whatsapp)"
    assert params["sessions.student_id"] == f"eq.{STUDENT}"
    assert params["created_at"].startswith("gte.")


async def test_texts_go_into_one_session_per_day() -> None:
    created = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json=[])  # no text session today yet
        created.update(json.loads(request.content))
        return httpx.Response(201, json=[{"id": "s-1"}])

    memory, calls = _memory(handler)
    assert await memory.text_session(STUDENT, "frank") == "s-1"
    assert calls[0].url.params["channel"] == "eq.sms"
    assert created["channel"] == "sms" and created["persona_id"] == "frank"
    assert await memory.text_session(STUDENT, "frank", "whatsapp") == "s-1"
    assert calls[2].url.params["channel"] == "eq.whatsapp"
    assert created["channel"] == "whatsapp"


async def test_opting_out_patches_the_number() -> None:
    memory, calls = _memory(lambda r: httpx.Response(204))
    await memory.set_sms_opt_out(PHONE, True)
    assert calls[0].method == "PATCH"
    assert "phone=eq.%2B447700900001" in str(calls[0].url)
    assert json.loads(calls[0].content) == {"sms_opted_out": True}


# ---------- texting ----------


def test_replies_are_plain_short_texts() -> None:
    assert as_text("**Great** job!\n- one\n- two") == "Great job! one two"
    long = "This is a sentence that goes on. " * 20
    text = as_text(long)
    assert len(text) <= 306 and text.endswith(".")
    # one Chinese character makes every segment 67 characters: two at most
    chinese = as_text("你好\uff01今天过得怎么样\uff1f" * 20)
    assert len(chinese) <= 134 and chinese.endswith("\uff1f")
    assert "\u2026" not in as_text("word " * 200)  # no ellipsis character
    assert len(as_text("This is a sentence that goes on. " * 40, "whatsapp")) > 306


def test_the_text_teacher_is_the_same_teacher_without_a_screen() -> None:
    text = build_text_instructions(
        FRANK, {"memories": [{"content": "plays basketball"}]}
    )
    assert "You are Frank" in text and "## How you text" in text
    assert "plays basketball" in text and "## Red lines" in text
    assert "show_widget" not in text and "send_sticker" not in text
    # same identity rules by text: never volunteer being an AI, never lie
    assert "AI English teacher" not in text and "never lie" in text


class FakeMemory:
    def __init__(self, link=None, sent=0, last=None):
        self.link, self.sent, self.last = link, sent, last
        self.opt_out: list[bool] = []
        self.stored: list[Turn] = []

    async def student_for_phone(self, phone):
        return dict(self.link) if self.link else None

    async def set_sms_opt_out(self, phone, opted_out):
        self.opt_out.append(opted_out)

    async def last_persona(self, student_id):
        return self.last

    async def text_session(self, student_id, persona_id, channel="sms"):
        self.channel = channel
        return "s-1"

    async def count_texts_from(self, session_id, limit):
        return min(self.sent, limit)

    async def load_snapshot(self, student_id):
        return {"memories": [{"content": "has a cat called Mimi"}]}

    async def recent_texts(self, student_id, limit=12, days=7):
        return [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hey!"},
        ]

    async def add_messages(self, session_id, turns):
        self.stored.extend(turns)


class FakeModel:
    def __init__(self, answer="Ha, nice one!"):
        self.answer = answer
        self.calls: list[tuple] = []

    async def reply(self, system, history, text):
        self.calls.append((system, history, text))
        return self.answer


async def _answer(memory, model, body, limit=60, **kw):
    reply = await answer_text(memory, model, TEACHERS, FRANK, PHONE, body, limit, **kw)
    return reply.text


async def test_an_unlinked_number_is_asked_to_link() -> None:
    assert await _answer(FakeMemory(), FakeModel(), "hello") == UNLINKED


async def test_a_picture_or_voice_note_gets_a_friendly_word() -> None:
    linked = FakeMemory(link={"student_id": STUDENT, "sms_opted_out": False})
    assert await _answer(linked, FakeModel(), "", has_media=True) == NO_MEDIA
    assert await _answer(linked, FakeModel(), "") is None


async def test_stop_and_start() -> None:
    memory = FakeMemory(link={"student_id": STUDENT, "sms_opted_out": False})
    assert await _answer(memory, FakeModel(), "STOP") is None
    assert memory.opt_out == [True]
    quiet = FakeMemory(link={"student_id": STUDENT, "sms_opted_out": True})
    assert await _answer(quiet, FakeModel(), "are you there?") is None
    back = FakeMemory(link={"student_id": STUDENT, "sms_opted_out": True})
    assert await _answer(back, FakeModel(), "start") == "Ha, nice one!"
    assert back.opt_out == [False]


async def test_a_text_is_answered_by_the_teacher_they_talk_to_with_shared_memory() -> (
    None
):
    memory = FakeMemory(
        link={"student_id": STUDENT, "sms_opted_out": False}, last="lily"
    )
    model = FakeModel()
    reply = await answer_text(
        memory, model, TEACHERS, FRANK, PHONE, "I won the match!", channel="whatsapp"
    )
    assert reply.text == "Ha, nice one!" and reply.session_id == "s-1"
    assert reply.body == "I won the match!" and memory.channel == "whatsapp"
    system, history, text = model.calls[0]
    assert "You are Lily" in system and "has a cat called Mimi" in system
    assert "by WhatsApp" in system
    assert history[0]["content"] == "hi" and text == "I won the match!"
    assert memory.stored == []  # stored by the server once the reply is sent


async def test_a_failed_model_still_answers_and_the_daily_limit_holds() -> None:
    linked = {"student_id": STUDENT, "sms_opted_out": False}
    assert await _answer(FakeMemory(link=linked), FakeModel(None), "hi") == LOST
    assert (
        await _answer(FakeMemory(link=linked, sent=3), FakeModel(), "hi", 3) == TOO_MANY
    )
    assert await _answer(FakeMemory(link=linked, sent=4), FakeModel(), "hi", 3) is None


# ---------- the webhook ----------

URL = "https://sms.speakwow.example/twilio/sms"
PARAMS = {
    "From": PHONE,
    "To": "+15550100000",
    "Body": "I won the match!",
    "MessageSid": "SM-test-message",
    "AccountSid": "AC-test-account",
}


def test_signature_matches_twilios_own_library() -> None:
    # computed with twilio.request_validator.RequestValidator("test-auth-token-12345")
    assert twilio_signature(URL, PARAMS, "test-auth-token-12345") == (
        "Nm1bObwxrBRo+BMZrUzUCmVzUL0="
    )
    # a header that is not ASCII is a refusal, not a crash
    assert not is_from_twilio(URL, PARAMS, "test-auth-token-12345", "签名")


class FakeSender:
    def __init__(self, ok=True):
        self.ok = ok
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, sender, to, body):
        self.sent.append((sender, to, body))
        return self.ok

    async def aclose(self):
        pass


def _app(memory, sender, model=None):
    app = web.Application()
    app[PERSONAS] = load_personas()
    app[MEMORY] = memory
    app[MODEL] = model or FakeModel()
    app[SENDER] = sender
    app[LIMIT] = 60
    app[TASKS] = set()
    app[TOLD_TO_LINK] = {}
    app.router.add_post("/twilio/sms", handle_sms)
    return app


async def test_a_reply_goes_back_the_way_it_came_and_is_kept_only_once_sent() -> None:
    linked = {"student_id": STUDENT, "sms_opted_out": False}
    memory, sender = FakeMemory(link=linked), FakeSender()
    app = _app(memory, sender)
    await deliver(
        app,
        PHONE,
        "whatsapp",
        "whatsapp:+15550100000",
        f"whatsapp:{PHONE}",
        "hi",
        False,
    )
    assert sender.sent == [
        ("whatsapp:+15550100000", f"whatsapp:{PHONE}", "Ha, nice one!")
    ]
    assert [t.role for t in memory.stored] == ["user", "assistant"]

    failed = FakeMemory(link=linked)
    await deliver(
        _app(failed, FakeSender(ok=False)), PHONE, "sms", "+1555", PHONE, "hi", False
    )
    assert [t.role for t in failed.stored] == ["user"]  # never "remembers" a lost reply


async def test_the_webhook_refuses_unsigned_requests_and_answers_signed_ones(
    monkeypatch,
) -> None:
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "test-auth-token-12345")
    monkeypatch.setenv("SMS_WEBHOOK_URL", URL)
    sender = FakeSender()
    app = _app(FakeMemory(), sender)  # the number is not linked
    async with TestClient(TestServer(app)) as client:
        forged = await client.post(
            "/twilio/sms", data=PARAMS, headers={"X-Twilio-Signature": "forged="}
        )
        assert forged.status == 403
        unsigned = await client.post("/twilio/sms", data=PARAMS)
        assert unsigned.status == 403
        signed = await client.post(
            "/twilio/sms",
            data=PARAMS,
            headers={"X-Twilio-Signature": "Nm1bObwxrBRo+BMZrUzUCmVzUL0="},
        )
        body = await signed.text()
        # Twilio gets an empty answer at once; the reply goes out separately
        assert signed.status == 200 and "<Message>" not in body
        for _ in range(50):
            if sender.sent:
                break
            await asyncio.sleep(0.01)
        assert sender.sent == [("+15550100000", PHONE, UNLINKED)]
        again = await client.post(
            "/twilio/sms",
            data=PARAMS,
            headers={"X-Twilio-Signature": "Nm1bObwxrBRo+BMZrUzUCmVzUL0="},
        )
        assert again.status == 200
        await asyncio.sleep(0.1)
        assert len(sender.sent) == 1  # "link this number" once a day, not per text
