"""The teacher's text line: Twilio posts each incoming SMS here and the reply
goes back in the same response (TwiML).

Runs as its own process next to the voice worker, from the same image:

    uv run src/sms_server.py

    PORT                 where to listen (Railway sets it), default 8080
    TWILIO_AUTH_TOKEN    signs every request Twilio sends; unsigned requests
                         are refused
    SMS_WEBHOOK_URL      the exact public URL Twilio posts to, e.g.
                         https://sms.example.com/twilio/sms (the signature
                         covers it, and behind a proxy the server cannot see it)
    SMS_DAILY_LIMIT      texts a student can send per day, default 60
plus the Supabase variables (memory) and a text model key (texting.py).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from xml.sax.saxutils import escape

from aiohttp import web

from memory import SupabaseMemory
from personas import DEFAULT_PERSONA_ID, Persona, load_personas
from phone import normalize_phone
from texting import DAILY_LIMIT, TextModel, answer_text

logger = logging.getLogger("speakwow-agent.sms")

PERSONAS = web.AppKey("personas", dict[str, Persona])
MEMORY = web.AppKey("memory", SupabaseMemory | None)
MODEL = web.AppKey("model", TextModel | None)


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
    return hmac.compare_digest(twilio_signature(url, params, token), signature)


def twiml(text: str | None) -> web.Response:
    message = f"<Message>{escape(text)}</Message>" if text else ""
    return web.Response(
        text=f'<?xml version="1.0" encoding="UTF-8"?><Response>{message}</Response>',
        content_type="text/xml",
    )


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
        logger.warning("refused an unsigned or badly signed SMS webhook")
        return web.Response(status=403, text="forbidden")
    phone = normalize_phone(params.get("From"))
    if not phone or not app[MEMORY]:
        return twiml(None)
    reply = await answer_text(
        app[MEMORY],
        app[MODEL],
        app[PERSONAS],
        app[PERSONAS][DEFAULT_PERSONA_ID],
        phone,
        params.get("Body", ""),
        daily_limit=int(os.getenv("SMS_DAILY_LIMIT") or DAILY_LIMIT),
    )
    return twiml(reply)


async def health(_: web.Request) -> web.Response:
    return web.Response(text="ok")


def make_app() -> web.Application:
    app = web.Application()
    app[PERSONAS] = load_personas()
    app[MEMORY] = SupabaseMemory.from_env()
    app[MODEL] = TextModel.from_env()
    app.router.add_post("/twilio/sms", handle_sms)
    app.router.add_get("/health", health)

    async def close(app: web.Application) -> None:
        if app[MEMORY]:
            await app[MEMORY].aclose()
        if app[MODEL]:
            await app[MODEL].aclose()

    app.on_cleanup.append(close)
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(
        "[sms.boot] "
        f"twilio_token={bool(os.getenv('TWILIO_AUTH_TOKEN'))} "
        f"webhook_url={bool(os.getenv('SMS_WEBHOOK_URL'))} "
        f"memory={bool(SupabaseMemory.from_env())} model={bool(TextModel.from_env())}",
        flush=True,
    )
    web.run_app(make_app(), port=int(os.getenv("PORT") or 8080))
