# backend/tests/test_auth.py
from starlette.responses import Response

import config
from routers.auth import _set_auth_cookie, logout


def _set_cookie_header(response: Response) -> str:
    return response.headers["set-cookie"].lower()


def test_set_auth_cookie_uses_lax_and_no_secure_in_development(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "development")
    response = Response()

    _set_auth_cookie(response, "sometoken")

    cookie = _set_cookie_header(response)
    assert "samesite=lax" in cookie
    assert "secure" not in cookie


def test_set_auth_cookie_uses_none_and_secure_in_production(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    response = Response()

    _set_auth_cookie(response, "sometoken")

    cookie = _set_cookie_header(response)
    assert "samesite=none" in cookie
    assert "secure" in cookie


def test_logout_deletes_cookie_with_matching_production_attrs(monkeypatch):
    monkeypatch.setattr(config.settings, "environment", "production")
    response = Response()

    logout(response)

    cookie = _set_cookie_header(response)
    assert "samesite=none" in cookie
    assert "secure" in cookie
