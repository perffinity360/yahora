---
date: 2026-10-01T18:44:00+05:30
author: neeraj
phase: "6A"
block: "N-A"
for: vishwajeet
title: "Changelog: one file per entry"
---

# Changelog: one file per entry

`docs/CHANGELOG.md` is frozen. From now on every changelog entry is its own file in
`docs/changelog/`, created by `scripts/changelog.mjs`. Adding an entry only ever creates a new
file, so our two branches can no longer conflict on the changelog. The full explanation is in
`docs/changelog/README.md`.

**What you do differently, starting now:**

- **Session start:** run `node scripts/changelog.mjs recent 8` and open the entries it lists,
  instead of reading `docs/CHANGELOG.md`. The new opener is in build plan §2.4 and in the 6A
  runbook ("From the moment N-A is merged").
- **Filing an entry:**
  `node scripts/changelog.mjs new vishwajeet "<title>" --phase 6A --block V-A --for neeraj`
  — it prints the path; open the file and fill in the six sections.
- **Notes addressed to you:** `node scripts/changelog.mjs for vishwajeet`.
- **Migration requests** are now entries too: I file `new neeraj "Migration request: …"
  --for vishwajeet`, and you answer with your own entry naming the migration file. The
  `## MIGRATION REQUESTS` section of the old file had nothing open, so nothing needs moving.
- **The rule:** anyone adds files; nobody edits another person's entry, except to fix a
  broken link. To correct something, add a new entry.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- **Do not append to `docs/CHANGELOG.md`** — not even a one-liner. It has a FROZEN banner
  at the top. It stays in place (28 files link into it); read it only to follow a link.
- **Do not add an index, "latest" or per-person file** to `docs/changelog/`. The moment two
  entries share a file, the conflicts come back.
- **Do not create entry files by hand** — the script gets the name, date and template
  right every time.

**⚠️ I edited files in your scope**, all instruction text only, as the 6A runbook (§2.2,
N-A file list) sets out — no code:

- `backend/CLAUDE.md` — the ownership table row, the "BREAKING" rule, the migration request
  protocol (steps 1–2), and the "post a handoff entry" line now point at the new tool.
- `backend/API.md` line ~2078 — one TODO note that said a rename "needs a BREAKING entry in
  docs/CHANGELOG.md" now points at `docs/changelog/`.
- `docs/YAHORA_BUILD_PLAN.md` — §1.5 repo layout, §2.4 (shared memory list and the session
  opener) and §2.5 (the handoff format).

Historical citations ("see docs/CHANGELOG.md 2026-08-12", in `backend/scripts/`,
`backend/API.md`, `docs/CURRENT_STATE.md` and so on) are untouched — they correctly point at
frozen history. The Phase 0–5 runbooks still say "append to docs/CHANGELOG.md" inside their
old prompts; those phases are finished, so I left them as a record.
