---
date: 2026-11-07T00:08:13+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Stale docs corrected, including your frontend/CLAUDE.md"
---

# Stale docs corrected, including your frontend/CLAUDE.md

A pass over docs that the repository contradicted. Every change was checked against the code on
7 Nov. Branch `v-text-formatting`, commit `0a9be23`.

## ⚠ Your file: `frontend/CLAUDE.md`

Only claims that the code or the file itself contradicted:

| § | Was | Now |
|---|---|---|
| 5 | Phase 0 directory map | adds `hooks/`, `utils/`, `components/community/`, `components/FormattedText/`, `pages/community/`, `pages/dev/`, and flags the footer's leaking CSS |
| 9 | `--pink-light #FFF4F7`, `--bg #F8F9FB`, body font Segoe UI | `#f4e0e4`, `#f2e5e1`, body font Inter, headings Bree Serif, as in `global.css` |
| 11 | the Phase 0 route list | points to `backend/API.md` as the full contract first |
| 15 | "Never Inter" | Inter for text, Bree Serif 400 for headings, the same as `DESIGN.md` and the app |
| 16 | tokens in `src/styles/tokens.css` | `src/styles/global.css` (`tokens.css` doesn't exist) |
| 16 | "use `motion`" | the same, plus: it isn't installed; pages animate with CSS on the community tokens |
| 16 | screenshot via Playwright, self-critique | no screenshot self-checks (your own §2 rule 4 and §14); build, then list what to check |

If any of that was meant as it was written, change it back. It's your file.

## The rest

- **`backend/API.md`:** Part 2 no longer says "nothing here is implemented". It marks the user, posts
  and reports modules as built, and social, notifications and admin as not built yet. `PORT` defaults
  to 5001. `increment_page_view()` is called by the footer.
- **`docs/CURRENT_STATE.md`:** 26 migrations, 22 RLS tables, open issues 2 and 5 resolved, 3 and 4
  still open, `cache.md` gone, and the Phase 7 loans listed.
- **`docs/runbooks/PHASE_7_RUNBOOK.md`:** Expo SDK 58, not 57 (your N-S note 3). Your notes 1 and 2
  (a touch rule for reactions on a phone browser, the §2.2 → §5.2 typo) were already in
  `COMMUNITY_SPEC.md`: §5.1 has the 450 ms long-press, and §2.2 says §5.2.
- **`docs/YAHORA_BUILD_PLAN.md`:** the local backend is on 5001.
- **`mobile/CLAUDE.md`** gets the same kind of fixes, committed with the app work.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. Documentation only.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

Nothing new.
