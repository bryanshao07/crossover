"""Rate limiting for auth endpoints.

Two layers protect the credential endpoints:

* Per-IP throttling via slowapi (``limiter``), applied as a route decorator.
* Per-account (per-email) throttling via an in-memory sliding window, so an
  attacker rotating IPs still cannot hammer a single account.

The per-account store is process-local. For a multi-worker or multi-instance
deploy, back both layers with a shared store (e.g. Redis) — slowapi accepts a
``storage_uri`` and the sliding window below would move to the same backend.
"""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict

from fastapi import HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-IP limiter. Endpoints opt in with @limiter.limit(...).
limiter = Limiter(key_func=get_remote_address)

_now = time.monotonic  # indirection so tests can control the clock

_account_hits: Dict[str, Deque[float]] = defaultdict(deque)
_lock = Lock()


def _prune(hits: Deque[float], cutoff: float) -> None:
    while hits and hits[0] <= cutoff:
        hits.popleft()


def check_account_limit(key: str, *, max_attempts: int, window_seconds: int) -> None:
    """Raise 429 if ``key`` already has >= max_attempts recorded in the window."""
    now = _now()
    with _lock:
        hits = _account_hits[key]
        _prune(hits, now - window_seconds)
        if len(hits) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
            )


def record_account_attempt(key: str) -> None:
    """Record one attempt against ``key``."""
    with _lock:
        _account_hits[key].append(_now())


def reset_account(key: str) -> None:
    """Clear an account's recorded attempts (e.g. after a successful login)."""
    with _lock:
        _account_hits.pop(key, None)


def _reset_all() -> None:
    """Test helper: clear all recorded per-account state."""
    with _lock:
        _account_hits.clear()
