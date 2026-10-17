"""Phone numbers as one shape (E.164: "+" and up to 15 digits), whatever a
carrier, Twilio or a SIP header hands us ("sip:+1 (555) 010-9999@trunk",
"tel:+44...", "whatsapp:+44..."). Calls, texts and WhatsApp messages find
their student by this exact string, the same one the website stores when a
student links a number."""

from __future__ import annotations

import re

_E164 = re.compile(r"^\+[1-9]\d{6,14}$")
_SCHEME = re.compile(r"^(sip|tel|whatsapp):", re.I)

# The carrier's caller-ID check (STIR/SHAKEN) as Twilio reports it. Only "A"
# means the carrier knows the caller owns the number; anything else, or no
# report at all, can be a spoofed caller ID.
VERIFIED_CALLER = "TN-Validation-Passed-A"


def normalize_phone(raw: str | None) -> str | None:
    text = (raw or "").strip()
    text = _SCHEME.sub("", text).split("@", 1)[0]
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    if text.startswith("00"):
        digits = digits[2:]
    elif not text.lstrip().startswith("+"):
        return None  # a local number without a country code is ambiguous
    phone = "+" + digits
    return phone if _E164.match(phone) else None


def message_channel(raw: str | None) -> str:
    """Which door a Twilio message came through: "whatsapp" when its From
    is "whatsapp:+...", else "sms"."""
    return "whatsapp" if (raw or "").strip().lower().startswith("whatsapp:") else "sms"


def caller_verified(attributes: dict[str, str]) -> bool:
    """True when the carrier vouched for the caller's number. LiveKit copies
    SIP headers onto the caller's participant as attributes; the inbound
    trunk must include X-Twilio-VerStat (docs/PHONE_AND_SMS.md)."""
    for key, value in attributes.items():
        if key.lower() in ("sip.h.x-twilio-verstat", "twilio.verstat"):
            return value.strip() == VERIFIED_CALLER
    return False


def phone_access(verified: bool, linked: bool, env: dict[str, str]) -> tuple[str, str]:
    """Who a caller is on the teacher line: ("student", why), ("guest", why)
    or ("refuse", why), following the same rules as the web token route.

    A number's student is trusted only when the carrier verified the caller
    ID, because spoofing a caller ID is easy and the teacher would otherwise
    read out another child's memory. PHONE_TRUST_UNVERIFIED=on lifts that for
    countries without STIR/SHAKEN, knowingly (docs/PHONE_AND_SMS.md)."""
    if (env.get("REQUIRE_BYOK") or "").lower() == "true":
        # own model keys live in the student's browser; a call has none
        return "refuse", "require_byok"
    trusted = verified or (env.get("PHONE_TRUST_UNVERIFIED") or "").lower() == "on"
    if linked and trusted:
        return "student", "verified" if verified else "trusted_unverified"
    if (env.get("ALLOW_GUESTS") or "").lower() == "false":
        return "refuse", "guests_not_allowed"
    return "guest", "unlinked" if not linked else "unverified_caller_id"
