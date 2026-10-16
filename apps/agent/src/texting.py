"""Texting with the teacher: the same teacher, memory and red lines as on a
call, with a text model in place of the voice one.

A student who linked their number on the website can text the teacher's
number between calls ("I won the match!"). The teacher answers like a person
texting, sees the latest texts and what it remembers from calls, and a call
sees the latest texts (memory.recent_texts), so both share one history.

Any OpenAI-compatible chat endpoint can write the texts; the first key found
wins:

    SMS_LLM_API_KEY      with SMS_LLM_BASE_URL / SMS_MODEL
    AI_GATEWAY_API_KEY   Vercel AI Gateway, SMS_MODEL default deepseek/deepseek-v4.1-flash
    OPENAI_API_KEY       OpenAI, gpt-4.1-mini
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from datetime import date

import httpx

from life import life_section
from memory import SupabaseMemory
from personas import Persona
from promptdata import as_data
from reflect import GATEWAY_MODEL, GATEWAY_URL, OPENAI_MODEL, OPENAI_URL
from teacher import CRITICAL, MEMORY_RULES, RED_LINES, ROLE, render_snapshot

logger = logging.getLogger("speakwow-agent.texting")

DAILY_LIMIT = 60
HISTORY_TEXTS = 20

# An SMS is billed per segment: 153 characters of plain Latin text, but only
# 67 once a single Chinese character or emoji is in it. Two segments at most.
SMS_GSM_CHARS = 306
SMS_UNICODE_CHARS = 134
WHATSAPP_CHARS = 700
_GSM7 = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€"
)
# a sentence ends at ". ", "! ", "? " or a Chinese full stop, ! or ? (U+3002, U+FF01, U+FF1F)
_SENTENCE_END = re.compile(r"(?<=[.!?])\s|(?<=[\u3002\uff01\uff1f])")

TEXTING = """
## How you text
Right now you are texting this student, by {door}: there is no voice, only
the words of your message. You are the same teacher they talk to on calls,
and you remember your calls and your texts with them.
- Write like a person texting: {length}. Plain text only: no lists,
  markdown, links or stage directions. A single real emoji now and then is
  fine.
- React to what they wrote before anything else. At most one question, and
  many texts need none.
- Texts are for keeping in touch, not lessons: no drills, quizzes or
  corrections by text. If you reply to a mistake, just use the right form in
  your own words.
- If they want to practise speaking, invite them to call you on this number
  or to open speakwow.ai.
- Never ask them to keep texting and never make them feel bad for stopping.
""".strip()

TEXT_LENGTH = {
    "sms": "one to three short sentences, under 300 characters (under 120 "
    "if you write any Chinese)",
    "whatsapp": "one to four short sentences",
}
DOOR = {"sms": "SMS", "whatsapp": "WhatsApp"}

UNLINKED = (
    "Hi! This is the Speakwow teacher line. To text and call your teacher, "
    "link this number at speakwow.ai/settings first."
)
NO_MEDIA = (
    "I can only read words here, not pictures or voice notes. Type it to me, "
    "or call me and say it!"
)
TOO_MANY = (
    "That's a lot of texts for one day! Let's pick it up tomorrow, or call me "
    "if you want to talk now."
)
LOST = "Sorry, I lost my train of thought. Could you send that again?"

STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_WORDS = {"start", "unstop", "yes"}


def build_text_instructions(
    persona: Persona,
    snapshot: dict | None,
    today: date | None = None,
    channel: str = "sms",
) -> str:
    parts = [
        "## Who you are\n"
        + ROLE.format(name=persona.display_name)
        + "\n\n"
        + persona.personality.strip(),
        TEXTING.format(door=DOOR[channel], length=TEXT_LENGTH[channel]),
    ]
    if persona.language_policy:
        parts.append(f"## Language policy\n{persona.language_policy}")
    parts.append(RED_LINES)
    if life := life_section(persona, today):
        parts.append(life)
    if brief := render_snapshot(snapshot):
        parts.append(
            f"{MEMORY_RULES}\n<student_memory>\n{as_data(brief)}\n</student_memory>"
        )
    parts.append(CRITICAL)
    return "\n\n".join(parts)


def is_gsm(text: str) -> bool:
    """True when the text fits the cheap 7-bit SMS alphabet."""
    return all(c in _GSM7 for c in text)


def as_text(text: str, channel: str = "sms") -> str:
    """What the model wrote, made fit to send: plain, short, whole sentences.
    An SMS stays within two segments, which for Chinese or an emoji means
    134 characters, and is cut at a sentence end (Chinese ones too)."""
    text = re.sub(r"[*_#`>]+", "", text or "")
    text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.M)
    text = re.sub(r"\s+", " ", text).strip().replace("…", "...")
    if channel == "whatsapp":
        limit = WHATSAPP_CHARS
    else:
        limit = SMS_GSM_CHARS if is_gsm(text) else SMS_UNICODE_CHARS
    if len(text) <= limit:
        return text
    cut = text[:limit]
    ends = [m.end() for m in _SENTENCE_END.finditer(cut)]
    if ends and ends[-1] > limit // 4:
        return cut[: ends[-1]].strip()
    head = cut[: limit - 3]
    return (head.rsplit(" ", 1)[0] if " " in head else head) + "..."


class TextModel:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = client or httpx.AsyncClient(timeout=12)

    @classmethod
    def from_env(cls) -> TextModel | None:
        base_url = os.getenv("SMS_LLM_BASE_URL")
        model = os.getenv("SMS_MODEL")
        if key := os.getenv("SMS_LLM_API_KEY"):
            return cls(key, base_url or OPENAI_URL, model or OPENAI_MODEL)
        if key := os.getenv("AI_GATEWAY_API_KEY"):
            return cls(key, base_url or GATEWAY_URL, model or GATEWAY_MODEL)
        if key := os.getenv("OPENAI_API_KEY"):
            return cls(key, base_url or OPENAI_URL, model or OPENAI_MODEL)
        return None

    async def aclose(self) -> None:
        await self.client.aclose()

    async def reply(self, system: str, history: list[dict], text: str) -> str | None:
        messages = [{"role": "system", "content": system}]
        messages += [
            {"role": m["role"], "content": m["content"]}
            for m in history
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        messages.append({"role": "user", "content": text})
        try:
            res = await self.client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": 0.7,
                    # the default text model thinks before it writes (300-550
                    # characters); at 200 tokens a long thought left no reply
                    "max_tokens": 1000,
                    "messages": messages,
                },
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
        except Exception:
            logger.exception("text reply failed")
            return None
        return content or None


@dataclass
class TextReply:
    """What to send back (None: stay silent), and where the exchange is kept
    once the reply has really gone out."""

    text: str | None
    session_id: str | None = None
    body: str = ""


async def answer_text(
    memory: SupabaseMemory,
    model: TextModel | None,
    personas: dict[str, Persona],
    default_persona: Persona,
    phone: str,
    body: str,
    daily_limit: int = DAILY_LIMIT,
    channel: str = "sms",
    has_media: bool = False,
) -> TextReply:
    """The teacher's reply to one text. Nothing is stored here: the server
    stores the exchange after the reply was sent."""
    body = body.strip()
    if not body and not has_media:
        return TextReply(None)
    link = await memory.student_for_phone(phone)
    if not link:
        return TextReply(UNLINKED)
    word = body.lower().strip(" .!")
    if word in STOP_WORDS:
        # SMS carriers confirm the opt-out themselves; the teacher goes quiet
        await memory.set_sms_opt_out(phone, True)
        return TextReply(None)
    if word in START_WORDS and link.get("sms_opted_out"):
        await memory.set_sms_opt_out(phone, False)
        link["sms_opted_out"] = False
    if link.get("sms_opted_out"):
        return TextReply(None)
    if not body:
        return TextReply(NO_MEDIA)

    student_id = link["student_id"]
    last = await memory.last_persona(student_id)
    persona = personas.get(last or "", default_persona)
    session_id = await memory.text_session(student_id, persona.id, channel)
    sent = (
        await memory.count_texts_from(session_id, daily_limit + 1) if session_id else 0
    )
    if sent > daily_limit:
        return TextReply(None)
    if sent == daily_limit:
        return TextReply(TOO_MANY, session_id, body)
    snapshot = await memory.load_snapshot(student_id)
    history = await memory.recent_texts(student_id, limit=HISTORY_TEXTS)
    system = build_text_instructions(persona, snapshot, channel=channel)
    written = await model.reply(system, history, body) if model else None
    reply = as_text(written, channel) if written else LOST
    return TextReply(reply or LOST, session_id, body)
