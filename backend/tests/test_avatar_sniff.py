# backend/tests/test_avatar_sniff.py
from routers.auth import _sniff_image_ext

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 20
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 20


def test_detects_png():
    assert _sniff_image_ext(PNG) == "png"


def test_detects_jpeg():
    assert _sniff_image_ext(JPEG) == "jpg"


def test_detects_webp():
    assert _sniff_image_ext(WEBP) == "webp"


def test_rejects_non_image_bytes():
    # e.g. an HTML/script payload mislabeled as image/png
    assert _sniff_image_ext(b"<html><script>alert(1)</script>") is None


def test_rejects_truncated_webp():
    assert _sniff_image_ext(b"RIFF") is None
