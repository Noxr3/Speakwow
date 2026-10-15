import base64
import json

from agent import parse_job_metadata

STUDENT = "aaaaaaaa-0000-4000-8000-000000000001"
VECTOR = "v1.AQEBAQEBAQEBAQEBDcP5xf_JhWq0pv4bUk8RWIrXNp997hkpekkiC0vCU9i23Xqd93b8rW5CeDvxTt6pvivZMn_D7my0Zr4yp8zaTCpl8PlNtA"


def test_defaults_to_a_guest_free_talk_with_frank() -> None:
    for raw in (None, "", "not json", "[1, 2]"):
        job = parse_job_metadata(raw)
        assert (job.persona.id, job.student_id, job.user_key, job.mode) == (
            "frank",
            None,
            None,
            "free",
        )


def test_reads_persona_student_mode_and_legacy_agent_name() -> None:
    job = parse_job_metadata(
        json.dumps({"persona": "lucy", "student_id": STUDENT, "mode": "course"})
    )
    assert (job.persona.id, job.student_id, job.mode) == ("lucy", STUDENT, "course")
    assert parse_job_metadata(json.dumps({"agent": "Lucy"})).persona.id == "lucy"


def test_course_mode_needs_a_real_student() -> None:
    assert parse_job_metadata(json.dumps({"mode": "course"})).mode == "free"
    assert (
        parse_job_metadata(json.dumps({"mode": "course", "student_id": "x"})).student_id
        is None
    )


def test_byok_opens_only_with_the_shared_secret(monkeypatch) -> None:
    raw = json.dumps({"byok": VECTOR})
    monkeypatch.delenv("BYOK_ENCRYPTION_KEY", raising=False)
    assert parse_job_metadata(raw).user_key is None
    monkeypatch.setenv(
        "BYOK_ENCRYPTION_KEY", base64.b64encode(bytes([7]) * 32).decode()
    )
    key = parse_job_metadata(raw).user_key
    assert (key.provider, key.key) == ("xai", "xai-vector-key-000000000000")
