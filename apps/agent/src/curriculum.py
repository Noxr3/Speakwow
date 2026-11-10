"""Small teaching workflow; a call may contain several study sessions."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from copy import deepcopy
from typing import Literal

from livekit.agents import function_tool

from promptdata import as_data
from reflect import Turn

ACTIVITIES = {
    "scenario": "Agree on roles and an outcome. Model once, role-play, then switch roles and try a new situation.",
    "picture": "Use show_material with a picture scene. Ask for visible details, then evidence-based inference and a connected description. Never pretend an unseen picture is visible.",
    "repeat": "Model one short original phrase aloud. Invite shadowing, focus on one sound or stress pattern, then ask for an independent sentence. Do not invent acoustic scores.",
    "word": "Introduce a few useful words in context. Check retrieval and a new student-made sentence, not only recognition.",
    "dictation": "Show a blank dictation writing surface, without the answer. Speak one short original sentence twice with a pause. Wait for a typed response; only then reveal and discuss differences. Voice alone cannot demonstrate spelling.",
    "write": "Show a writing surface. Agree on audience and purpose, plan briefly, wait for a typed draft, give one useful revision, then invite independent writing. Do not score writing from spoken answers.",
    "reading": "Show a short original passage with show_material. Give silent reading time. Check gist, evidence and inference, then ask for a retelling. Do not read the whole passage aloud first.",
    "story": "Build characters, a setting and a small problem together. Model a connective, let the student develop events, then invite an independent ending and retelling.",
    "mixed": "Choose a short activity that demonstrates the goals, model it, practise together, then check transfer.",
}
Action = Literal["start", "pause", "chat", "resume", "finish"]


def sessions_for(unit: dict) -> list[dict]:
    sessions = (unit.get("content") or {}).get("sessions")
    if isinstance(sessions, list) and sessions:
        return [s for s in sessions if isinstance(s, dict) and s.get("id")]
    goals = [g["id"] for g in unit.get("goals", []) if g.get("id")]
    return [
        {
            "id": key,
            "title": title,
            "kind": kind,
            "activity": "mixed",
            "goal_ids": goals,
        }
        for key, title, kind in [
            ("learn", "Learn together", "lesson"),
            ("practice", "Make it your own", "practice"),
            ("check", "Independent check", "exam"),
        ]
    ]


def active_session(unit: dict | None) -> dict | None:
    if not unit:
        return None
    progress = unit.get("session_progress") or {}
    if unit.get("status") == "mastered" and not progress:
        return None  # grandfather already-mastered units
    return next(
        (
            s
            for s in sessions_for(unit)
            if progress.get(s["id"], {}).get("status") != "mastered"
        ),
        None,
    )


def session_goals(unit: dict, step: dict | None = None) -> list[dict]:
    step = step or active_session(unit)
    ids = set((step or {}).get("goal_ids") or [])
    return [g for g in unit.get("goals", []) if g.get("id") in ids]


def requires_written_response(unit: dict, step: dict) -> bool:
    return step.get("activity") in ("write", "dictation") or any(
        goal.get("kind") == "writing" for goal in session_goals(unit, step)
    )


Save = Callable[[dict, dict, list[Turn], str], Awaitable[dict | None]]


class StudyFlow:
    def __init__(self, unit: dict, save: Save | None = None):
        self.unit = deepcopy(unit)
        self.step = active_session(self.unit)
        self.review_mode = not self.step and bool(sessions_for(self.unit))
        if self.review_mode:
            self.step = sessions_for(self.unit)[-1]
        self.phase = "welcome" if self.step else "complete"
        self.written: set[str] = set()
        self.turns: list[Turn] = []
        self.detour_turns = 0
        self.save = save
        self.attempt_id = str(uuid.uuid4())
        self.lock = asyncio.Lock()
        self.feedback = ""

    @property
    def quiet(self) -> bool:
        return self.phase in ("break", "assessing")

    def record_written(self, text: str) -> None:
        if self.phase == "teaching":
            self.written.add(text.strip())

    def observe(self, turn: Turn) -> None:
        if self.phase == "teaching":
            if turn.role == "user" and turn.text.strip() in self.written:
                turn = Turn("user", "[Written response] " + turn.text)
            self.turns.append(turn)
        elif self.phase == "chat" and turn.role == "user":
            self.detour_turns += 1

    def note(self) -> str:
        if not self.step:
            return "This lesson is complete. Celebrate one specific achievement. Offer relaxed conversation; never invent another lesson."
        detail = as_data(
            f"{self.unit.get('title')}: {self.step.get('title')}. {self.step.get('brief', '')}"
        )
        guide = ACTIVITIES.get(self.step.get("activity"), ACTIVITIES["mixed"])
        rules = (
            "This is an independent assessment. Agree before starting. No model answers, hints, recasts or corrections until they submit; use fresh tasks. Do not use practice quiz widgets that reveal hints or allow retries; use free responses and the material surface. If they need help, pause the exam, teach separately and retry with a new task. Never claim an official qualification."
            if self.step.get("kind") == "exam"
            else "Model briefly, practise together, then ask for independent evidence of each goal."
        )
        phase = {
            "welcome": "Catch up briefly, then offer the lesson. If they are ready immediately, call lesson_step(start); no mandatory small-talk quota.",
            "teaching": "Stay with this session and its goals. When there is evidence for every goal, call lesson_step(finish) to check and save it before claiming completion. For a tangent call lesson_step(chat); for a requested rest call lesson_step(pause).",
            "break": "The student is taking a silent break. No questions, reminders, corrections or exercises. Wait until they explicitly want to resume; then call lesson_step(resume).",
            "chat": "Enjoy their topic briefly without grading it. "
            + (
                "Offer a gentle bridge back using their topic; ask whether to continue the lesson or rest. Do not force them."
                if self.detour_turns >= 3
                else "After two or three exchanges, offer a natural connection to the lesson."
            ),
            "between": "The previous work is saved. Share one specific observation, then offer the next session, a little chat or a break. Wait for their choice; call lesson_step(resume) only when they agree.",
        }.get(self.phase, "")
        return f"{phase}\nCurrent session data: {detail}\n{guide}\n{rules}\n{self.feedback}"

    async def change(self, action: Action) -> str:
        async with self.lock:
            if action == "pause":
                self.phase = "break"
            elif action == "chat":
                self.phase = "chat"
                self.detour_turns = 0
            elif action in ("start", "resume"):
                self.phase = "teaching" if self.step else "complete"
            elif action == "finish":
                if (
                    self.phase != "teaching"
                    or not self.step
                    or not any(t.role == "user" for t in self.turns)
                ):
                    return (
                        "No teaching evidence to assess. Continue at the current place."
                    )
                if requires_written_response(self.unit, self.step) and not any(
                    t.role == "user" and t.text.startswith("[Written response]")
                    for t in self.turns
                ):
                    return "Wait for a typed response before assessing writing or spelling. Spoken answers are not written evidence."
                if not self.save:
                    return "Progress could not be checked. Keep this session open and do not claim completion."
                self.phase = "assessing"
                try:
                    result = await self.save(
                        self.unit, self.step, list(self.turns), self.attempt_id
                    )
                finally:
                    self.phase = "teaching"
                if result is None:
                    return "Progress could not be checked or stored. Keep this session open and try again later."
                old_step, old_unit = self.step["id"], self.unit["id"]
                self.unit = result
                self.step = active_session(result)
                passed = (
                    not self.step
                    or self.unit["id"] != old_unit
                    or self.step["id"] != old_step
                )
                self.feedback = (
                    "The independent check passed."
                    if passed
                    else "More evidence is needed. Revisit the weak goals and try a new task; this session is not complete."
                )
                self.phase = (
                    "between"
                    if passed and self.step
                    else ("complete" if not self.step else "teaching")
                )
                self.turns = []
                self.written.clear()
                self.attempt_id = str(uuid.uuid4())
            return self.note()


def make_lesson_tool(flow: StudyFlow, changed: Callable[[], Awaitable[None]]):
    @function_tool
    async def lesson_step(action: Action) -> str:
        """Change phase after the student's choice. start/resume: planned work;
        pause: silent rest; chat: a short tangent; finish: assess and save actual work.
        Never finish from attendance or small talk. Claim completion only after passing.
        """
        result = await flow.change(action)
        await changed()
        return result

    return lesson_step
