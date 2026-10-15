"""Bring your own key: open a student's sealed API key.

The web app seals {"provider", "key"} with AES-256-GCM before it stores it or
puts it in the job metadata, so the key never sits in the database, LiveKit
or logs in clear text. Both sides share BYOK_ENCRYPTION_KEY (32 random bytes,
base64). Format, mirrored by apps/web/lib/byok.ts:

    v1.<base64url(iv[12] || ciphertext || tag[16])>   AAD = b"speakwow-byok-v1"
"""

from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger("speakwow-agent.byok")

AAD = b"speakwow-byok-v1"
PREFIX = "v1."


@dataclass(frozen=True)
class UserKey:
    provider: str
    key: str


def _b64decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.replace("+", "-").replace("/", "_"))


def secret_from_env() -> bytes | None:
    raw = os.getenv("BYOK_ENCRYPTION_KEY")
    if not raw:
        return None
    try:
        secret = _b64decode(raw.strip())
    except ValueError:
        return None
    return secret if len(secret) == 32 else None


def open_sealed(sealed: str, secret: bytes) -> UserKey | None:
    if not isinstance(sealed, str) or not sealed.startswith(PREFIX):
        return None
    try:
        blob = _b64decode(sealed[len(PREFIX) :])
        plain = AESGCM(secret).decrypt(blob[:12], blob[12:], AAD)
        data = json.loads(plain)
        provider, key = data["provider"], data["key"]
    except Exception:
        logger.warning("could not open a sealed user key")
        return None
    if not isinstance(provider, str) or not isinstance(key, str) or not key:
        return None
    return UserKey(provider=provider, key=key)
