import base64

from byok import open_sealed, secret_from_env

SECRET = bytes([7]) * 32
# Produced by apps/web/lib/byok.ts (see its byok.test.ts): both sides must agree.
VECTOR = "v1.AQEBAQEBAQEBAQEBDcP5xf_JhWq0pv4bUk8RWIrXNp997hkpekkiC0vCU9i23Xqd93b8rW5CeDvxTt6pvivZMn_D7my0Zr4yp8zaTCpl8PlNtA"


def test_opens_what_the_web_app_sealed() -> None:
    key = open_sealed(VECTOR, SECRET)
    assert key is not None
    assert (key.provider, key.key) == ("xai", "xai-vector-key-000000000000")


def test_wrong_secret_or_garbage_opens_nothing() -> None:
    assert open_sealed(VECTOR, bytes([8]) * 32) is None
    assert open_sealed("v1.garbage", SECRET) is None
    assert open_sealed("plain-key", SECRET) is None


def test_secret_from_env(monkeypatch) -> None:
    monkeypatch.setenv("BYOK_ENCRYPTION_KEY", base64.b64encode(SECRET).decode())
    assert secret_from_env() == SECRET
    monkeypatch.setenv("BYOK_ENCRYPTION_KEY", "too-short")
    assert secret_from_env() is None
