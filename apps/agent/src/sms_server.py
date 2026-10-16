"""The teacher's text line: Twilio posts each incoming SMS or WhatsApp message
here; the reply goes out through Twilio's Messages API.

Twilio waits at most 15 seconds for an answer and drops a late one, while a
reply needs several database reads and a model call. So the webhook answers
at once with an empty TwiML response and the reply is sent separately; the
exchange is stored only once the reply really went out, so the teacher never
remembers a text the student did not get.

Runs as its own process next to the voice worker, from the same image:

    uv run src/sms_server.py

    PORT                 where to listen (Railway sets it), default 8080
    TWILIO_ACCOUNT_SID   the account replies are sent from
    TWILIO_AUTH_TOKEN    signs every request Twilio sends (unsigned requests
                         are refused) and authenticates the replies
    SMS_WEBHOOK_URL      the exact public URL Twilio posts to, e.g.
                         https://sms.example.com/twilio/sms (the signature
                         covers it, and behind a proxy the server cannot see
                         it). SMS and WhatsApp both post to this one URL.
    SMS_DAILY_LIMIT      texts a student can send per day and channel, default 60
plus the Supabase variables (memory) and a text model key (texting.py).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import logging
import os
from datetime import UTC, datetime

import httpx
from aiohttp import web

from memory import SupabaseMemory
from personas import DEFAULT_PERSONA_ID, Persona, load_personas
from phone import message_channel, normalize_phone
from reflect import Turn
from texting import DAILY_LIMIT, UNLINKED, TextModel, TextReply, answer_text

logger = logging.getLogger("speakwow-agent.sms")

PERSONAS = web.AppKey("personas", dict[str, Persona])
MEMORY = web.AppKey("memory", SupabaseMemory | None)
MODEL = web.AppKey("model", TextModel | None)
SENDER = web.AppKey("sender", "TwilioSender | None")
LIMIT = web.AppKey("daily_limit", int)
TASKS = web.AppKey("tasks", set)
TOLD_TO_LINK = web.AppKey("told_to_link", dict)

EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


def twilio_signature(url: str, params: dict[str, str], auth_token: str) -> str:
    """Twilio's request signature: HMAC-SHA1 over the URL followed by every
    POST parameter as name+value, sorted by name, base64-encoded."""
    payload = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    digest = hmac.new(auth_token.encode(), payload.encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


def is_from_twilio(
    url: str, params: dict[str, str], token: str, signature: str
) -> bool:
    if not token or not signature:
        return False
    # compared as bytes: a non-ASCII header must be a refusal, not a crash
    expected = twilio_signature(url, params, token).encode()
    return hmac.compare_digest(expected, signature.encode("utf-8", "replace"))


class TwilioSender:
    """Sends a message through Twilio's Messages API."""

    def __init__(
        self, account_sid: str, auth_token: str, client: httpx.AsyncClient | None = None
    ) -> None:
        self.url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        )
        self.auth = (account_sid, auth_token)
        self.client = client or httpx.AsyncClient(timeout=10)

    @classmethod
    def from_env(cls) -> TwilioSender | None:
        sid, token = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN")
        return cls(sid, token) if sid and token else None

    async def send(self, sender: str, to: str, body: str) -> bool:
        """True once Twilio accepted the message. `sender` and `to` are the
        addresses exactly as Twilio gave them (with "whatsapp:" when it is
        WhatsApp): the reply goes back the way the message came."""
        for attempt in range(2):
            try:
                res = await self.client.post(
                    self.url,
                    auth=self.auth,
                    data={"From": sender, "To": to, "Body": body},
                )
            except httpx.HTTPError as error:
                logger.warning("reply not sent: %s", type(error).__name__)
                continue
            if res.status_code < 500:
                if res.status_code >= 400:
                    logger.warning("reply refused by Twilio: %s", res.status_code)
                return res.status_code < 300
            await asyncio.sleep(1 + attempt)
        return False

    async def aclose(self) -> None:
        await self.client.aclose()


def first_link_reminder_today(told: dict, phone: str, today: str) -> bool:
    """An unlinked number hears "link this number first" once a day, not on
    every text (an auto-responder would otherwise loop on paid replies)."""
    if told.get(phone) == today:
        return False
    if len(told) > 10_000:
        told.clear()
    told[phone] = today
    return True


async def deliver(
    app: web.Application,
    phone: str,
    channel: str,
    reply_from: str,
    reply_to: str,
    body: str,
    has_media: bool,
) -> None:
    """Work out the reply, send it, and only then store the exchange."""
    memory, sender = app[MEMORY], app[SENDER]
    if memory is None or sender is None:
        return
    reply: TextReply = await answer_text(
        memory,
        app[MODEL],
        app[PERSONAS],
        app[PERSONAS][DEFAULT_PERSONA_ID],
        phone,
        body,
        daily_limit=app[LIMIT],
        channel=channel,
        has_media=has_media,
    )
    if reply.text == UNLINKED and not first_link_reminder_today(
        app[TOLD_TO_LINK], phone, datetime.now(UTC).date().isoformat()
    ):
        return
    sent = bool(reply.text) and await sender.send(reply_from, reply_to, reply.text)
    if reply.session_id:
        turns = [Turn("user", reply.body)]
        if sent:
            turns.append(Turn("assistant", reply.text))
        await memory.add_messages(reply.session_id, turns)


async def handle_sms(request: web.Request) -> web.Response:
    app = request.app
    params = {k: str(v) for k, v in (await request.post()).items()}
    url = os.getenv("SMS_WEBHOOK_URL") or str(request.url)
    if not is_from_twilio(
        url,
        params,
        os.getenv("TWILIO_AUTH_TOKEN", ""),
        request.headers.get("X-Twilio-Signature", ""),
    ):
        logger.warning("refused an unsigned or badly signed message webhook")
        return web.Response(status=403, text="forbidden")
    raw_from, raw_to = params.get("From", ""), params.get("To", "")
    phone = normalize_phone(raw_from)
    if phone and raw_to:
        has_media = (params.get("NumMedia") or "0").strip() not in ("", "0")
        task = asyncio.create_task(
            deliver(
                app,
                phone,
                message_channel(raw_from),
                raw_to,
                raw_from,
                params.get("Body", ""),
                has_media,
            ),
            name="text-reply",
        )
        app[TASKS].add(task)
        task.add_done_callback(app[TASKS].discard)
        task.add_done_callback(_log_failure)
    return web.Response(text=EMPTY_TWIML, content_type="text/xml")


def _log_failure(task: asyncio.Task) -> None:
    if not task.cancelled() and (error := task.exception()) is not None:
        logger.error("text reply failed", exc_info=error)


async def health(_: web.Request) -> web.Response:
    return web.Response(text="ok")


def daily_limit_from_env() -> int:
    raw = os.getenv("SMS_DAILY_LIMIT")
    try:
        return max(1, int(raw)) if raw else DAILY_LIMIT
    except ValueError:
        logger.warning("SMS_DAILY_LIMIT=%r is not a number; using %d", raw, DAILY_LIMIT)
        return DAILY_LIMIT


def make_app() -> web.Application:
    app = web.Application()
    app[PERSONAS] = load_personas()
    app[MEMORY] = SupabaseMemory.from_env()
    app[MODEL] = TextModel.from_env()
    app[SENDER] = TwilioSender.from_env()
    app[LIMIT] = daily_limit_from_env()
    app[TASKS] = set()
    app[TOLD_TO_LINK] = {}
    app.router.add_post("/twilio/sms", handle_sms)
    app.router.add_get("/health", health)

    async def close(app: web.Application) -> None:
        if app[TASKS]:
            await asyncio.wait(app[TASKS], timeout=20)
        for client in (app[MEMORY], app[MODEL], app[SENDER]):
            if client:
                await client.aclose()

    app.on_cleanup.append(close)
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(
        "[sms.boot] "
        f"twilio_token={bool(os.getenv('TWILIO_AUTH_TOKEN'))} "
        f"twilio_account={bool(os.getenv('TWILIO_ACCOUNT_SID'))} "
        f"webhook_url={bool(os.getenv('SMS_WEBHOOK_URL'))} "
        f"memory={bool(SupabaseMemory.from_env())} model={bool(TextModel.from_env())}",
        flush=True,
    )
    web.run_app(make_app(), port=int(os.getenv("PORT") or 8080))
