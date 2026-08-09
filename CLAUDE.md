# Yahora

A campus marketplace and community app for Indian universities.
`backend/` (Express + Supabase) · `frontend/` (React web) · `mobile/` (Expo) ·
`supabase/` (migrations).

The plan of record is `docs/YAHORA_BUILD_PLAN.md`. Read the section for the phase you are
working on before writing any code.

---

## Repo ownership (two developers, separate sessions)

- Vishwajeet owns: supabase/, backend/, mobile/
- Neeraj owns: frontend/
- Shared, both may append: docs/CHANGELOG.md, docs/LEARNINGS.md

Never modify a directory outside the owner's scope without saying so
loudly in your response. The two developers work in separate Claude
sessions and cannot see each other's conversations. Files in this
repo are the ONLY shared memory between them.

At the start of every session, read docs/CHANGELOG.md to find out
what the other developer changed.

> **`backend/` is now split between both of them.** The line above predates the shared-backend
> split in plan §0.5. Neeraj owns four backend modules (`user`, `social`, `notifications`,
> `reports`); Vishwajeet owns the rest plus all shared infrastructure. **The authoritative
> file-by-file map is in `backend/CLAUDE.md` — read it before editing anything under
> `backend/`.** Every file in `backend/src/modules/` also carries an `OWNER:` banner at the
> top. Respect it.

---

## Mandatory: teaching notes

The two people working on this repo are early-career developers
learning as they build. Whenever your work involves a concept,
pattern, tool, or failure mode that a developer with under two years
of experience would not already know, you MUST append an entry to
docs/LEARNINGS.md in the same response.

Examples of things that qualify: database indexes and when they're
used, race conditions, RLS, cursor vs offset pagination, N+1 queries,
optimistic UI updates, debouncing, idempotency, cascade deletes,
transaction isolation, why a trigger fired twice.

Write the entry for a beginner. Do not compress it into revision
notes. Always include a concrete worked example using OUR actual
tables and code, not a generic example.

Do not ask permission to add an entry. Just add it.
If nothing new came up in a task, add nothing — don't pad the file.
