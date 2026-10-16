"""The first-call interview, in the student's own language.

Before any English, a new student is interviewed the way a tutor talks to a
family on the first visit: in the language they are comfortable in, one easy
question at a time. What comes out is their profile: what to call them, why
they learn English, what feels hard, their textbook, what they like talking
about. The teacher saves it with save_profile, as user memories
(intake_memories, memory.save_intake), and every later call starts from them.

A guest (not signed in) gets the same interview, but nothing can be kept, so
the teacher suggests signing in at the end.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date

from livekit.agents import function_tool

from user_memory import live_memories, safe_content

logger = logging.getLogger("speakwow-agent.intake")

# BCP 47 primary tag -> how the model is told the language. Chinese is the
# common case; zh-TW / zh-HK learners read traditional characters.
LANGUAGES = {
    "zh": "Mandarin Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "es": "Spanish",
    "pt": "Portuguese",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ru": "Russian",
    "tr": "Turkish",
    "ar": "Arabic",
    "hi": "Hindi",
    "en": "English",
}
CEFR = ("A1", "A2", "B1", "B2", "C1", "C2")
GRADES = ("7", "8", "9", "other_school", "adult")


def language_tag(raw: object) -> str | None:
    """A safe BCP 47 tag from the browser ("zh-CN"), or None."""
    tag = str(raw or "").strip().replace("_", "-")
    parts = tag.split("-")
    if (
        not tag
        or not parts[0].isalpha()
        or not 2 <= len(parts[0]) <= 3
        or len(tag) > 16
    ):
        return None
    return "-".join(
        [parts[0].lower(), *(p.upper() if len(p) == 2 else p for p in parts[1:])]
    )


def language_name(tag: str | None) -> str | None:
    if not tag:
        return None
    name = LANGUAGES.get(tag.split("-")[0])
    if name == "Mandarin Chinese" and tag.upper().endswith(("TW", "HK", "HANT")):
        return "Mandarin Chinese (Taiwan / Hong Kong usage)"
    return name


# The memory that says the interview happened. It counts even when the
# student deleted it: a deleted key can never be written again, so treating
# it as "not done" would interview them on every call.
ONBOARDING_KEY = "onboarding"


def needs_intake(snapshot: dict | None, has_context: bool, signed_in: bool) -> bool:
    """A student the teacher knows nothing about yet: never interviewed, and
    nothing learned in a call before. A signed-in student whose snapshot could
    not be read is not a new one: no interview because of a database hiccup."""
    if signed_in and snapshot is None:
        return False
    rows = (snapshot or {}).get("memories")
    if isinstance(rows, list) and any(
        isinstance(r, dict) and r.get("key") == ONBOARDING_KEY for r in rows
    ):
        return False
    return not has_context


@dataclass(frozen=True)
class Intake:
    language: str  # e.g. "Mandarin Chinese"
    tag: str | None  # e.g. "zh-CN"
    signed_in: bool
    courses: tuple[tuple[str, str], ...] = field(default_factory=tuple)  # (slug, title)


def intake_flow(intake: Intake) -> str:
    lang = intake.language
    courses = (
        "\n".join(f"  - {slug}: {title}" for slug, title in intake.courses)
        if intake.courses
        else ""
    )
    course_step = (
        "- Which textbook their school uses, if they are at school. Courses you "
        f"can start them on (use the id in save_profile):\n{courses}\n"
        if courses
        else ""
    )
    keep = (
        "Call save_profile once with everything you learned, then tell them "
        "in two short sentences what you understood and what you will do "
        "together (their course, or which topics to talk about)."
        if intake.signed_in
        else "Call save_profile once with what you learned (they are not "
        "signed in, so it lasts only for this call), say in two short "
        "sentences what you understood, and tell them that if they sign in "
        "you will remember all of it next time."
    )
    return f"""
## How the conversation goes
This is your first call with this student. Before any English, interview
them in {lang}, the language they are comfortable in, the way a tutor talks
to a new family on the first visit: warm, curious, never like a form. Your
hello has already been said. Say everything in {lang} until step 2; if they
answer in English on their own, follow them.
1. The interview, one easy question per turn, reacting to each answer with
   a few warm words and sometimes a little about yourself. Find out, in
   roughly this order and in your own words:
   - What they would like you to call them.
   - Whether they are at school (which grade) or an adult.
   - Why they are learning English, and what they would love to be able to
     do with it (an exam such as 中考, 高考 or IELTS, school, work, travel,
     films, friends).
   - What feels hardest: speaking, listening, words, grammar, or nerves.
{course_step}   - What they like talking about.
   - How often and how long they would like to practise.
   Skip what they already told you, and what you already know about them
   (under student_memory). Exit when you know at least what to call them,
   why they learn, and what feels hard.
2. A little English: tell them in {lang} that you will now try a few easy
   sentences in English, and that mistakes are fine. Ask two or three very
   easy English questions about what they just told you, to hear their
   level. No corrections. If they get stuck, go back to {lang}.
3. Wrap up, in {lang}. {keep} Ask whether they want to start now or next
   time, and follow their answer.
4. Close. When they say goodbye or want to stop: one warm line, and one
   thing you are looking forward to next time. Then stop talking.
Go step by step and never rush. This interview is the whole point of the
first call; nothing is taught in it.
""".strip()


def intake_opening(intake: Intake, name: str) -> str:
    return (
        f"Say hello in {intake.language}, in one or two short sentences: you "
        f"are {name}, their English teacher, and before any English you would "
        "like to get to know them a little. No question yet. Then stop and let "
        "them answer."
    )


Save = Callable[[dict], Awaitable[str]]


# What the onboarding needs to find out. After each of the student's turns,
# Jev (coach.Coach.evaluate) answers "have they told you this yet?" for each,
# and the teacher is told what is known and what is still missing, so the
# interview neither repeats itself nor ends early. REQUIRED must be known
# before the call moves on to English.
SLOTS: dict[str, str] = {
    "name": "what they would like to be called",
    "stage": "whether they are at school (and which grade) or an adult",
    "reason": "why they are learning English, or what they want to use it for",
    "hard": "what feels hardest about English for them",
    "textbook": "which English textbook their school uses",
    "interests": "what they like talking about or doing",
    "schedule": "how often or how long they would like to practise",
}
REQUIRED = ("name", "reason", "hard")
KNOWN = 0.7  # Jev's probability for "already told"


# Memories a student may already have before their first call (written by
# themselves on their profile page, or carried over from the old profile
# fields): the slot each one answers, so the interview does not ask again.
SLOT_MEMORIES = {
    "preferred-name": "name",
    "school-context": "stage",
    "learning-intention": "reason",
    "hard-parts": "hard",
    "interests": "interests",
    "practice-schedule": "schedule",
}


def known_from_memories(snapshot: dict | None) -> set[str]:
    return {
        SLOT_MEMORIES[r["key"]]
        for r in live_memories(snapshot)
        if r.get("key") in SLOT_MEMORIES
    }


def slot_questions(intake: Intake) -> dict:
    questions = {
        key: {
            "type": "boolean",
            "instructions": "Judging only what the STUDENT has said in this "
            f"conversation: have they already told the teacher {what}?",
        }
        for key, what in SLOTS.items()
    }
    if not intake.courses:
        questions.pop("textbook")
    else:
        questions["textbook"]["instructions"] += (
            " If they said they are not at school, answer yes."
        )
    return questions


def heard(answers: dict, key: str) -> bool:
    answer = answers.get(key)
    return (
        isinstance(answer, dict)
        and isinstance(answer.get("probability"), (int, float))
        and answer["probability"] >= KNOWN
    )


def progress_note(answers: dict | None, intake: Intake) -> str | None:
    """The onboarding's progress for the teacher, from Jev's answers; None
    without answers (the flow's own list then guides the interview)."""
    if not answers:
        return None
    asked = slot_questions(intake)
    known = [key for key in asked if heard(answers, key)]
    missing = [key for key in asked if key not in known]
    if all(key in known for key in REQUIRED):
        rest = (
            " If it fits, you could still ask "
            + "; ".join(SLOTS[k] for k in missing)
            + "."
            if missing
            else ""
        )
        return (
            "Onboarding: you know what you need. When the moment fits, move on "
            f"to step 2, a little English.{rest}"
        )
    told = ", ".join(SLOTS[k] for k in known) or "nothing yet"
    return (
        f"Onboarding so far. They have told you: {told}. Still to find out, "
        "one at a time and in your own words, after reacting to what they "
        f"just said: {'; '.join(SLOTS[k] for k in missing)}."
    )


def profile_schema(intake: Intake) -> dict:
    slugs = [slug for slug, _ in intake.courses]
    text = {"type": "string"}
    texts = {"type": "array", "items": {"type": "string"}}
    properties: dict = {
        "name": {**text, "description": "What they want to be called"},
        "grade": {"type": "string", "enum": list(GRADES)},
        "reason": {**text, "description": "Why they learn English, in their words"},
        "goal": {
            **text,
            "description": "What they want to be able to do, one sentence",
        },
        "hard_parts": {**texts, "description": "What feels hardest"},
        "interests": {**texts, "description": "Topics they like talking about"},
        "level": {"type": "string", "enum": [*CEFR, "unknown"]},
        "schedule": {
            **text,
            "description": "How often and how long they want to practise",
        },
        "notes": {**texts, "description": "Anything else worth remembering"},
    }
    if slugs:
        properties["course"] = {"type": "string", "enum": [*slugs, "none"]}
    return {
        "name": "save_profile",
        "description": "Save what you learned in the first-call interview, "
        "once, at the end of it. Fill every field they told you about (their "
        "name, grade, why they learn, what is hard, interests, how often), "
        "not only the last few things they said.",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": ["reason", "hard_parts"],
        },
    }


def make_profile_tool(intake: Intake, save: Save):
    slugs = [slug for slug, _ in intake.courses]

    saved = [False]

    @function_tool(raw_schema=profile_schema(intake))
    async def save_profile(raw_arguments: dict[str, object]) -> str:
        if saved[0]:
            # seen on grok: the same call twice in one reply
            return "Already saved. Carry on with the conversation."
        profile = clean_profile(raw_arguments, slugs)
        saved[0] = True
        try:
            return await save(profile)
        except Exception:
            logger.exception("could not save the interview")
            return "Saving did not work this time. Do not mention it; carry on."

    return save_profile


def clean_profile(raw: dict[str, object], slugs: list[str]) -> dict:
    """Only known fields, short strings, valid enums."""

    def short(value: object, limit: int = 200) -> str | None:
        text = str(value or "").strip()
        return text[:limit] or None

    def many(value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        return [s for s in (short(v, 120) for v in value if isinstance(v, str)) if s][
            :8
        ]

    profile = {
        "name": short(raw.get("name"), 60),
        "grade": raw.get("grade") if raw.get("grade") in GRADES else None,
        "reason": short(raw.get("reason")),
        "goal": short(raw.get("goal")),
        "hard_parts": many(raw.get("hard_parts")),
        "interests": many(raw.get("interests")),
        "level": raw.get("level") if raw.get("level") in CEFR else None,
        "schedule": short(raw.get("schedule")),
        "notes": many(raw.get("notes")),
        "course": raw.get("course") if raw.get("course") in slugs else None,
    }
    return {k: v for k, v in profile.items() if v not in (None, [], "")}


def intake_memories(
    profile: dict, intake: Intake, teacher: str, today: date | None = None
) -> list[dict]:
    """The interview as user memories: one declarative fact per key, in the
    words the reviewer and the profile page use. Only create operations: a new
    student has no memory from a call yet, and what they wrote themselves is
    kept (SupabaseMemory._apply_memory_ops skips existing keys)."""
    today = today or date.today()
    facts: list[tuple[str, str]] = []
    if name := profile.get("name"):
        facts.append(("preferred-name", f"The student prefers to be called {name}."))
    grade = profile.get("grade")
    if grade in ("7", "8", "9"):
        facts.append(("school-context", f"The student is in grade {grade} at school."))
    elif grade == "other_school":
        facts.append(("school-context", "The student is at school."))
    elif grade == "adult":
        facts.append(("school-context", "The student is an adult, not at school."))
    reason, goal = profile.get("reason"), profile.get("goal")
    if reason or goal:
        intention = " ".join(
            part
            for part in (
                f"The student learns English because: {reason}." if reason else "",
                f"They would like to: {goal}." if goal else "",
            )
            if part
        )
        facts.append(("learning-intention", intention))
    if hard := profile.get("hard_parts"):
        facts.append(
            ("hard-parts", "The student finds these hardest: " + "; ".join(hard) + ".")
        )
    if interests := profile.get("interests"):
        facts.append(
            (
                "interests",
                "The student enjoys talking about: " + ", ".join(interests) + ".",
            )
        )
    if schedule := profile.get("schedule"):
        facts.append(
            ("practice-schedule", f"The student would like to practise: {schedule}.")
        )
    # "CEFR X" is what user_memory.remembered_level reads for pacing.
    if level := profile.get("level"):
        facts.append(
            (
                "english-level",
                f"The student's English was first estimated at CEFR {level} "
                "in their first-call interview.",
            )
        )
    if notes := profile.get("notes"):
        facts.append(("first-call-notes", "From the first call: " + "; ".join(notes)))
    if intake.tag and intake.tag.split("-")[0] != "en":
        facts.append(
            (
                "native-language",
                f"The student's own language is {intake.language} ({intake.tag}).",
            )
        )
    facts.append(
        (
            ONBOARDING_KEY,
            f"The student had their first-call interview with {teacher} on "
            f"{today.isoformat()}.",
        )
    )
    return [
        {"action": "create", "key": key, "content": content[:800]}
        for key, content in facts
        if safe_content(content)
    ]
