# backend/tests/test_rate_limit.py
import pytest
from fastapi import HTTPException

import rate_limit


@pytest.fixture(autouse=True)
def _clean_account_state():
    rate_limit._reset_all()
    yield
    rate_limit._reset_all()


def _drive(key, n, *, max_attempts=5, window=100):
    """Simulate n attempts (check then record) and return how many were allowed."""
    allowed = 0
    for _ in range(n):
        try:
            rate_limit.check_account_limit(key, max_attempts=max_attempts, window_seconds=window)
        except HTTPException:
            break
        rate_limit.record_account_attempt(key)
        allowed += 1
    return allowed


def test_allows_up_to_max_then_blocks():
    assert _drive("user@x.com", 10, max_attempts=5) == 5


def test_block_raises_429():
    for _ in range(5):
        rate_limit.record_account_attempt("user@x.com")
    with pytest.raises(HTTPException) as exc:
        rate_limit.check_account_limit("user@x.com", max_attempts=5, window_seconds=100)
    assert exc.value.status_code == 429


def test_reset_account_clears_lockout():
    for _ in range(5):
        rate_limit.record_account_attempt("user@x.com")
    rate_limit.reset_account("user@x.com")
    # no raise after reset
    rate_limit.check_account_limit("user@x.com", max_attempts=5, window_seconds=100)


def test_keys_are_independent():
    for _ in range(5):
        rate_limit.record_account_attempt("a@x.com")
    # a@x.com is locked, b@x.com is untouched
    with pytest.raises(HTTPException):
        rate_limit.check_account_limit("a@x.com", max_attempts=5, window_seconds=100)
    rate_limit.check_account_limit("b@x.com", max_attempts=5, window_seconds=100)


def test_window_expiry_frees_the_account(monkeypatch):
    t = {"now": 1000.0}
    monkeypatch.setattr(rate_limit, "_now", lambda: t["now"])
    for _ in range(5):
        rate_limit.record_account_attempt("user@x.com")
    with pytest.raises(HTTPException):
        rate_limit.check_account_limit("user@x.com", max_attempts=5, window_seconds=60)
    # advance past the window — old hits should be pruned
    t["now"] = 1000.0 + 61
    rate_limit.check_account_limit("user@x.com", max_attempts=5, window_seconds=60)
