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
- Shared, both may append: docs/CHANGELOG.md

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

## Database — hard rules for Claude Code

NEVER run any of these. If a task seems to need one, stop and ask:
- supabase db push
- supabase link / supabase unlink
- supabase migration repair
- supabase db dump (needs the production password — the human runs it)
- psql or any connection string pointing at *.supabase.co

Allowed: supabase migration new, supabase db reset, supabase status,
supabase start / stop, and psql against 127.0.0.1:54322 (local only).

Only Vishwajeet writes files under supabase/migrations/.
Only Vishwajeet runs anything that touches production.

