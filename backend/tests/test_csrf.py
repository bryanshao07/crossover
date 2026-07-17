# backend/tests/test_csrf.py
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import Headers
from starlette.requests import Request

from auth import require_csrf_header
from main import app

client = TestClient(app)


def _request_with_headers(headers: dict) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw})


# --- dependency unit tests ---

def test_require_csrf_header_rejects_when_missing():
    with pytest.raises(HTTPException) as exc:
        require_csrf_header(_request_with_headers({}))
    assert exc.value.status_code == 403


def test_require_csrf_header_rejects_wrong_value():
    with pytest.raises(HTTPException):
        require_csrf_header(_request_with_headers({"X-Requested-With": "nope"}))


def test_require_csrf_header_accepts_expected_value():
    # does not raise
    require_csrf_header(_request_with_headers({"X-Requested-With": "XMLHttpRequest"}))


# --- endpoint tests (logout needs no auth, so it isolates the CSRF check) ---

def test_logout_blocked_without_csrf_header():
    r = client.post("/auth/logout", headers={"X-Requested-With": ""})
    assert r.status_code == 403


def test_logout_allowed_with_csrf_header():
    r = client.post("/auth/logout", headers={"X-Requested-With": "XMLHttpRequest"})
    assert r.status_code == 200


def test_unauthenticated_avatar_delete_without_header_is_rejected():
    # whether 403 (CSRF) or 401 (auth), it must not succeed without the header
    r = client.delete("/auth/avatar", headers={"X-Requested-With": ""})
    assert r.status_code in (401, 403)
