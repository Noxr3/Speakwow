"""Phone numbers as one shape (E.164: "+" and up to 15 digits), whatever a
carrier or SIP header hands us ("sip:+1 (555) 010-9999@trunk", "tel:+44...").
Calls and texts find their student by this exact string, the same one the
website stores when a student links a number."""

from __future__ import annotations

import re

_E164 = re.compile(r"^\+[1-9]\d{6,14}$")


def normalize_phone(raw: str | None) -> str | None:
    text = (raw or "").strip()
    text = re.sub(r"^(sip|tel):", "", text, flags=re.I).split("@", 1)[0]
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    if text.startswith("00"):
        digits = digits[2:]
    elif not text.lstrip().startswith("+"):
        return None  # a local number without a country code is ambiguous
    phone = "+" + digits
    return phone if _E164.match(phone) else None
