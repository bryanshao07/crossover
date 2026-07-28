# backend/tests/test_auth_rate_limit.py
#
# Endpoint-level rate limiting. These use bogus emails/passwords so the requests
# only ever do a read-only SELECT (no users are created) and always fail auth.
import pytest
from fastapi.testclient import TestClient

import rate_limit
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_limiter_state():
    rate_limit._reset_all()      # per-account sliding window
    rate_limit.limiter.reset()   # per-IP slowapi storage
    yield
    rate_limit._reset_all()
    rate_limit.limiter.reset()


def test_login_locks_out_after_five_attempts_on_same_account():
    payload = {"email": "nobody-lockout@example.com", "password": "wrong-password"}
    statuses = [client.post("/auth/login", json=payload).status_code for _ in range(6)]
    # first 5 are rejected as bad credentials, 6th is throttled per-account
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


def test_login_throttled_per_ip_across_different_accounts():
    # distinct emails so the per-account limit (5) never trips; only per-IP (10) can
    statuses = []
    for i in range(11):
        payload = {"email": f"nobody-ip-{i}@example.com", "password": "wrong-password"}
        statuses.append(client.post("/auth/login", json=payload).status_code)
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
