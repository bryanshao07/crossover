# Log In With Google — Design Spec

**Date:** 2026-08-16
**Branch:** `feature/google-oauth-login`
**Status:** Approved design, pending implementation plan

## Goal

CrossOver authenticates with email + password only: `POST /auth/signup` and
`POST /auth/login` in `backend/routers/auth.py`, issuing an HS256 JWT in an
httpOnly `access_token` cookie that `auth.get_current_user` reads back.

This spec adds **Log in with Google** to the auth page as a third way to obtain
that same cookie. Everything downstream of the cookie — `get_current_user`,
favorites, saved comparisons, avatar routes — is unchanged and unaware of how
the user signed in.

## Chosen flow: Google Identity Services, ID token verified server-side

The browser renders Google's button, the user picks an account in a popup, and
Google hands the SPA a signed **ID token** (a JWT). The frontend posts that token
to a new `POST /auth/google`; the backend verifies it and sets the normal auth
cookie.

The alternative — the server-side authorization code flow — was considered and
rejected. It yields refresh tokens for calling Google APIs on the user's behalf,
which this product does not do. In exchange it requires a client **secret** to
manage and rotate, per-environment redirect URIs, and a cross-domain redirect
back to the Vercel frontend. The ID token flow needs only the (public) client ID
and no redirect URIs at all.

It also adds **no new Python dependency**: `PyJWT` is already in
`requirements.txt` and ships `PyJWKClient`, which fetches and caches Google's
signing keys.

## Security decisions

These three are the substance of the feature; the rest is plumbing.

### 1. The token must be verified, never merely decoded

An ID token arriving from the browser is attacker-controlled input. Decoding its
claims without checking the signature would let anyone authenticate as anyone.
Verification asserts all of:

- **Signature** — RS256 against Google's published key set at
  `https://www.googleapis.com/oauth2/v3/certs`.
- **`aud` equals our client ID** — without this, a token minted for a *different*
  Google application would be accepted here. This is the check that stops a
  malicious site from replaying tokens its own users handed it.
- **`iss`** is `https://accounts.google.com` or `accounts.google.com` (Google
  emits both spellings).
- **`exp`** — enforced by PyJWT during decode.

The `PyJWKClient` is instantiated once at module scope so keys are cached across
requests rather than refetched per login, consistent with the project rule that
startup-loaded data is never reloaded per request.

### 2. Account linking requires a Google-verified email

Linking rule: signing in with Google using an email that already has a password
account logs into **that existing account** — same user id, same favorites, same
saved comparisons — and stamps `google_sub` onto the row.

This is only safe when Google asserts the address actually belongs to the signer.
A Google Workspace administrator can create accounts on a custom domain bearing
arbitrary, unverified addresses; without a check, such an account could be used
to claim an existing CrossOver user by email. So the endpoint **rejects any token
whose `email_verified` claim is not true**. Normal consumer accounts always carry
`email_verified: true`, so this is invisible to real users.

Lookup order is `google_sub` first, then email. Google's `sub` is a permanent
per-account identifier while an email address can be changed by its owner, so
`sub` is the durable key and email is the one-time linking bridge.

### 3. Password login against a Google-only account returns a generic 401

A user created via Google has no password. When someone submits the login form
for such an account, the response is the same `401 "Invalid credentials"` as any
wrong password — it does not reveal that the account exists or that it uses
Google. This matches the deliberate posture of the signup route, whose generic
"Unable to complete signup" message is guarded by an existing test
(`test_signup_existing_email_returns_generic_message`).

The friendlier alternative ("This account uses Google sign-in") was considered
and rejected: it confirms to anyone typing an address that an account exists.

This is also a **latent crash fix**. `routers/auth.py:160` currently calls
`verify_password(body.password, user.hashed_password)`; once that column can hold
`NULL`, a passwordless row would raise inside passlib and surface as a 500. The
guard is required, not merely cosmetic.

## Schema

One Alembic migration, `add_google_auth_to_users`:

| Column | Change |
| --- | --- |
| `users.hashed_password` | `nullable=False` → `nullable=True` |
| `users.google_sub` | new: `String`, unique, nullable, indexed |

`hashed_password` must become nullable because a Google-only user has no
password and must not be given a guessable placeholder. Storing a random unusable
hash instead was rejected: `NULL` states the fact directly and makes the
"passwordless account" branch explicit rather than dependent on a hash that can
never match.

`google_sub` is nullable because password-only users have none, and unique so one
Google account cannot be attached to two CrossOver users.

Three revision files already exist in `backend/alembic/versions/`. The new
migration's `down_revision` must be set from the actual current head, confirmed
with `alembic heads` at implementation time — not guessed from filenames.

## Config

| Setting | Where | Notes |
| --- | --- | --- |
| `google_client_id: Optional[str] = None` | `backend/config.py` | read from `GOOGLE_CLIENT_ID` |
| `VITE_GOOGLE_CLIENT_ID` | `frontend/.env` | ships in the JS bundle — a client ID is public by design |

Both default to absent. When the backend setting is missing, `POST /auth/google`
returns **503**; when the frontend variable is missing, the button does not
render. This mirrors the existing optional `gemini_api_key` treatment, so a
checkout without Google credentials still runs the whole app.

The client ID is `878594319937-qhtj0hbmg33ld8v8fi95at1o5g8m562c.apps.googleusercontent.com`.
It is referenced through config in both tiers, never hardcoded in source.

## Backend — `POST /auth/google`

Request body: `{ "credential": "<ID token>" }`. Rate limited `10/minute`, matching
`login` and `signup`.

1. If `settings.google_client_id` is unset → 503.
2. Verify the token per §1. Any failure → 401 with a generic message.
3. Reject `email_verified is not True` → 401.
4. Resolve the user:
   - by `google_sub` → log in;
   - else by normalized email → **link**: set `google_sub`, leave
     `hashed_password` untouched so the password still works;
   - else **create**: `hashed_password=None`, `google_sub`, and `avatar_url` from
     the token's `picture` claim.
5. Set the cookie via the existing `_set_auth_cookie` and return the existing
   `UserResponse` shape.

Email is normalized (`strip().lower()`) on the same rule `_EmailBody` already
applies, so Google-sourced addresses can never create a case-variant duplicate of
an existing account.

Avatar: a new Google user gets their Google profile picture as `avatar_url`. This
is a starting value only — the existing `/auth/avatar/*` routes override it, and
linking an existing account never overwrites an avatar the user already chose.

## Frontend

**Script loading.** `https://accounts.google.com/gsi/client` loads lazily, on
mount of `AuthPage` only, so no other page pays for it. Load failure leaves the
email/password form fully functional.

**Button.** Rendered by Google via `google.accounts.id.renderButton` into a ref'd
div, configured `theme: "filled_black"`, `shape: "rectangular"`,
`text: "continue_with"`. Google's branding terms require their rendered button
rather than a custom one; these options are the closest available fit to the
`#0a0a0f` background and the 2–4px-radius design system.

**Placement.** Above the email form with an "OR" divider, on **both** the Log In
and Sign Up tabs — one endpoint serves both, since it creates the account when
it doesn't exist.

**Wiring.** `api.googleLogin(credential)` posts to `/auth/google`;
`AuthContext` gains `loginWithGoogle(credential)`, which seeds the
`["auth","me"]` query cache exactly as `login` does, then the page navigates to
`/` like the existing handlers.

## Files touched

| File | Change |
| --- | --- |
| `backend/alembic/versions/<new>.py` | new — nullable password, `google_sub` |
| `backend/db_models.py` | `hashed_password` nullable, `google_sub` column |
| `backend/config.py` | `google_client_id` setting |
| `backend/routers/auth.py` | `POST /auth/google`, token verification, login guard |
| `backend/.env`, `backend/.env.example` | `GOOGLE_CLIENT_ID` |
| `backend/tests/test_google_auth.py` | new — see Testing |
| `frontend/src/api/client.js` | `googleLogin(credential)` |
| `frontend/src/context/AuthContext.jsx` | `loginWithGoogle` |
| `frontend/src/pages/AuthPage.jsx` | script load, button, OR divider |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID` |

No new Python or npm dependency.

## Testing

New `backend/tests/test_google_auth.py`. Token verification is stubbed so tests
never reach the network or need live Google credentials:

- missing `google_client_id` → 503
- malformed / unverifiable token → 401
- `email_verified: false` → 401 (the linking-safety check)
- `aud` mismatch → 401
- new Google user is created with `google_sub` and the picture avatar
- existing password account links by email: **same user id**, `hashed_password`
  preserved, password login still succeeds afterward
- match by `google_sub` when the token's email differs from the stored one
- password login against a passwordless account → 401, not 500

DB-backed cases need Postgres on `localhost:5432`, which is currently not
running; results must be reported honestly rather than assumed.

## Manual setup (owner, not implementable from the repo)

In Google Cloud Console, on the OAuth 2.0 Client ID above:

- **Authorized JavaScript origins**: `http://localhost:5173`,
  `http://127.0.0.1:5173`, `https://crossover-ten-theta.vercel.app`
- **Authorized redirect URIs**: none — this flow does not use them
- OAuth consent screen configured, with the owner added as a test user while the
  app is unpublished
- Deploy env: `GOOGLE_CLIENT_ID` on Render, `VITE_GOOGLE_CLIENT_ID` on Vercel

## Explicitly out of scope (YAGNI)

- Setting or resetting a password on a Google-created account
- Unlinking Google from an account
- Any Google API access beyond identity (no refresh tokens, no extra scopes)
- Other providers (Apple, GitHub)
- `nonce` replay binding — the token is short-lived, TLS-protected, and bound by
  `aud`; adding nonce round-tripping is unjustified complexity here
- One Tap / auto-select prompts — explicit button click only

## Verification

- With `GOOGLE_CLIENT_ID` unset, the app boots, the button is absent, and
  email/password login is unaffected.
- Signing in with Google on a brand-new email creates a user and lands
  authenticated on `/`, with `/auth/me` returning that user.
- Signing in with Google on an email that already has a password account returns
  the **same user id**, and that account's password login still works afterward.
- Password login against a Google-created account returns 401, not 500.
- `venv/bin/python -m pytest tests/` passes (Postgres-dependent tests require the
  DB to be up).
- `npm run lint` and `npx vite build` pass before each commit.
