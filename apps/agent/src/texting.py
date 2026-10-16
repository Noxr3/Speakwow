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
from datetime import date

import httpx

from life import life_section
from memory import SupabaseMemory
from personas import Persona
from promptdata import as_data
from reflect import GATEWAY_MODEL, GATEWAY_URL, OPENAI_MODEL, OPENAI_URL, Turn
from teacher import CRITICAL, MEMORY_RULES, RED_LINES, ROLE, render_snapshot

logger = logging.getLogger("speakwow-agent.texting")

MAX_TEXT_CHARS = 320
DAILY_LIMIT = 60
HISTORY_TEXTS = 20

TEXTING = """
## How you text
Right now you are texting this student, by SMS: there is no voice, only the
words of your message. You are the same teacher they talk to on calls, and
you remember your calls and your texts with them.
- Write like a person texting: one to three short sentences, under 300
  characters. Plain text only: no lists, markdown, links or stage
  directions. A single real emoji now and then is fine.
- React to what they wrote before anything else. At most one question, and
  many texts need none.
- Texts are for keeping in touch, not lessons: no drills, quizzes or
  corrections by text. If you reply to a mistake, just use the right form in
  your own words.
- If they want to practise speaking, invite them to call you on this number
  or to open speakwow.ai.
- Never ask them to keep texting and never make them feel bad for stopping.
""".strip()

UNLINKED = (
    "Hi! This is the Speakwow teacher line. To text and call your teacher, "
    "link this number at speakwow.ai/settings first."
)
TOO_MANY = (
    "That's a lot of texts for one day! Let's pick it up tomorrow, or call me "
    "if you want to talk now."
)
LOST = "Sorry, I lost my train of thought. Could you send that again?"

STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_WORDS = {"start", "unstop", "yes"}


def build_text_instructions(
    persona: Persona, snapshot: dict | None, today: date | None = None
) -> str:
    parts = [
        "## Who you are\n"
        + ROLE.format(name=persona.display_name)
        + "\n\n"
        + persona.personality.strip(),
        TEXTING,
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


def as_sms(text: str) -> str:
    """What the model wrote, made fit for an SMS: plain, short, whole
    sentences."""
    text = re.sub(r"[*_#`>]+", "", text or "")
    text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.M)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= MAX_TEXT_CHARS:
        return text
    cut = text[:MAX_TEXT_CHARS]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[: end + 1] if end > 40 else cut.rsplit(" ", 1)[0] + "…"


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
                    "max_tokens": 200,
                    "messages": messages,
                },
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
        except Exception:
            logger.exception("text reply failed")
            return None
        return as_sms(content) or None


async def answer_text(
    memory: SupabaseMemory,
    model: TextModel | None,
    personas: dict[str, Persona],
    default_persona: Persona,
    phone: str,
    body: str,
    daily_limit: int = DAILY_LIMIT,
) -> str | None:
    """The teacher's reply to one text, or None to stay silent."""
    body = body.strip()
    if not body:
        return None
    link = await memory.student_for_phone(phone)
    if not link:
        return UNLINKED
    word = body.lower().strip(" .!")
    if word in STOP_WORDS:
        # the carrier confirms the opt-out itself; the teacher goes quiet
        await memory.set_sms_opt_out(phone, True)
        return None
    if word in START_WORDS and link.get("sms_opted_out"):
        await memory.set_sms_opt_out(phone, False)
        link["sms_opted_out"] = False
    if link.get("sms_opted_out"):
        return None

    student_id = link["student_id"]
    last = await memory.last_persona(student_id)
    persona = personas.get(last or "", default_persona)
    session_id = await memory.text_session(student_id, persona.id)
    sent = (
        await memory.count_texts_from(session_id, daily_limit + 1) if session_id else 0
    )
    if sent > daily_limit:
        return None
    if sent == daily_limit:
        reply = TOO_MANY
    else:
        snapshot = await memory.load_snapshot(student_id)
        history = await memory.recent_texts(student_id, limit=HISTORY_TEXTS)
        system = build_text_instructions(persona, snapshot)
        reply = (await model.reply(system, history, body) if model else None) or LOST
    if session_id:
        await memory.add_messages(
            session_id, [Turn("user", body), Turn("assistant", reply)]
        )
    return reply
