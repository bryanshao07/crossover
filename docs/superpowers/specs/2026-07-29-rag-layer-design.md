# RAG Layer for CrossOver — Design Spec

**Date:** 2026-07-29
**Branch:** `feature/rag-layer`
**Status:** Approved design, pending implementation plan

## Goal

Add a Retrieval-Augmented Generation (RAG) layer to CrossOver that serves
**three** motivations at once through **one shared retrieval artifact**:

1. **Learn/showcase a legit end-to-end RAG implementation.**
2. **Better explanations** — ground Gemini's comparison bullets in concrete
   stylistic facts instead of paraphrasing raw attribute numbers.
3. **Better search UX** — let users find players via natural language
   (e.g. "lockdown defender with elite passing") rather than substring match.

## Why RAG here (and where it does *not* help)

The current `/explain` path builds a prompt from the two players' 7 numeric
attributes + DNA + position + similarity score. Those numbers are **already in
context**, so retrieving them back over a vector store would add nothing — that
would be RAG as decoration.

RAG earns its keep only when it supplies knowledge the model cannot derive from
what's already in the prompt. The lever is a corpus of **qualitative prose** the
model can't reconstruct from the 7 attributes. Once that corpus exists, a single
embedding layer powers both grounded explanations and semantic search.

## Corpus decision

**LLM-generated style cards from raw stats.** The repo currently has zero prose
— only stats CSVs and the 7 derived attributes. We generate one ~3-sentence
"style card" per player, offline, by feeding each player's **full raw stat line**
(`nba-stats.csv` / `soccer-stats.csv` — richer than the 7 attributes: points,
assists, rebounds, blocks, position specifics, etc.) to Gemini flash.

- Self-contained, fully automated, ~800 players.
- Real retrieval over real prose; no scraping, name-matching, or licensing.
- Rejected alternatives: external scouting text (heavy scraping/matching
  sub-project) and hybrid (more moving parts than needed for v1).

## Embedding decision

**Gemini `text-embedding-004`** (same API/key already wired up).

- Player cards embedded **offline** into `exports/`.
- Search queries embedded **at runtime** — one API call per semantic query,
  `lru_cache`d so repeats are free.
- For ~800 players, a vector **database is overkill**. In-memory NumPy cosine
  search loaded once at startup — the same approach already used for
  `sim_matrix.csv`. No Pinecone/Chroma/pgvector.
- Trade-off accepted: semantic search adds one embedding round-trip on submit.
  Mitigated by only running semantic search on an explicit action (Enter), never
  per autocomplete keystroke.

## Architecture

### 1. Offline build artifacts

New standalone script `backend/scripts/build_rag.py` (**not** the notebook —
`notebook/` is off-limits unless explicitly asked). It:

- Iterates all ~800 players; pulls each raw stat line via `ds.nba_stats` /
  `ds.soccer_stats`.
- Asks Gemini flash to write a ~3-sentence style card per player.
- Embeds each card with `text-embedding-004`.
- Writes two artifacts (matching the existing `exports/` JSON convention):
  - `exports/style_cards.json` → `{name: "scouting prose..."}`
  - `exports/style_embeddings.json` → `{name: [floats]}`
- Idempotent/resumable: skips names already present in the output files.
- Rate-limit friendly (throttled, retries on transient errors).
- One-time cost: ~1,600 flash/embedding calls, pennies.

### 2. `data_store.py` — load once at startup

- Load `style_cards.json` and `style_embeddings.json` into `_cards` (dict) and an
  embeddings matrix (NumPy array + parallel list of names) in `load()`.
- New accessors: `style_card(name)`, plus access to the embedding matrix + names.
- **Graceful degradation:** if either file is absent, both features fall back and
  the app runs exactly as it does today (no hard dependency on the artifacts).

### 3. `services/rag.py` (new)

- `embed_query(text) -> list[float] | None` — Gemini embedding, `lru_cache`d.
  Returns `None` if no key configured.
- `semantic_search(query, sport, position, limit) -> list[dict] | None` — embed
  query, cosine vs the matrix, apply the existing sport/position filters, return
  top-k rows using the same `_with_attributes` row shape as `/search`.
- Returns `None` when the key or embeddings are unavailable, so the caller falls
  back to keyword search.

### 4. Semantic search — extend `GET /search`

- Add a `mode` query param. Default (`mode` absent or `keyword`) keeps the
  current substring filter, so autocomplete keystrokes stay instant and free.
- `mode=semantic` runs `rag.semantic_search`, falling back to the substring
  filter when semantic is unavailable.
- Frontend change (deferred to a second increment): a "smart search"
  toggle/submit on the search results page. Semantic runs on Enter, **not** per
  keystroke.

### 5. Grounded explanations — `gemini.py` / `explain.py`

- Replace the currently **unused** `stats_a` / `stats_b` params in `build_prompt`
  with the retrieved style cards (`ds.style_card(name)`).
- `build_prompt` injects `card_a` + `card_b` as scouting context and instructs
  Gemini to reference concrete stylistic facts, while keeping the 7 numeric
  attributes.
- Fallback path (`_fallback`, no-key behavior) unchanged.

## Testing

Follows the existing pattern in `test_explain_router.py`
(`test_explain_returns_bullets_without_api_key`):

- Cosine-ranking test on fixture embedding vectors (deterministic).
- `mode=semantic` falls back to keyword search when embeddings are absent.
- Explanation still returns bullets when no key is configured.
- Explanation prompt includes the style-card text when cards are present.

## Scope & increments

1. **Backend-first (this PR's core):** build script + artifacts + `data_store`
   loading + `services/rag.py` + `/search` `mode=semantic` + grounded `explain` +
   tests. Commit working.
2. **Frontend (second increment):** small "smart search" toggle on the search
   results page.

Matches the "commit working features incrementally" workflow rule.

## Explicitly out of scope (YAGNI)

- Vector database (NumPy is correct for ~800 players).
- Conversational "chat about this matchup" bot.
- Any `notebook/` changes.
- External scouting-text corpus.

## Unrelated note (surfaced, not part of this work)

`backend/.env` currently has a live `GEMINI_API_KEY` committed to the repo.
Consider rotating it and adding `.env` to `.gitignore`.
