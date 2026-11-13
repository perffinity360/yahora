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
- Shared, both add entries: docs/changelog/ — one new file per entry,
  created with `node scripts/changelog.mjs new …`. Never edit another
  person's entry except to fix a broken link. (docs/CHANGELOG.md is
  frozen history — read it, never append to it.)

Never modify a directory outside the owner's scope without saying so
loudly in your response. The two developers work in separate Claude
sessions and cannot see each other's conversations. Files in this
repo are the ONLY shared memory between them.

At the start of every session, run `node scripts/changelog.mjs recent 8`
and open the entries it lists to find out what the other developer
changed; `node scripts/changelog.mjs for <your name>` lists every entry
addressed to you. Older phases are released into docs/changelog/releases/
— `recent` names them; open one only to follow a reference. Do not read
the whole of the frozen docs/CHANGELOG.md at startup — open it only to
follow a link into its history. How the system works:
docs/changelog/README.md.

> **`backend/` is now split between both of them.** The line above predates the shared-backend
> split in plan §0.5. Neeraj owns four backend modules (`user`, `social`, `notifications`,
> `reports`); Vishwajeet owns the rest plus all shared infrastructure. **The authoritative
> file-by-file map is in `backend/CLAUDE.md` — read it before editing anything under
> `backend/`.** Every file in `backend/src/modules/` also carries an `OWNER:` banner at the
> top. Respect it.

---

## How we work (owner, 12 Nov), for everyone working on Yahora

- **Handle execution and small design decisions yourself.** Don't stop to ask about what is small and
  reversible: decide, do it, and say what you decided. **Involve the owner in decisions that could
  fundamentally or drastically change the product experience:** product direction, branding, navigation
  architecture, core user journeys, significant feature changes.
- **Use every capability you have.** Design skills, research, libraries, your own judgement: the goal is
  to build things better, whatever the method. `frontend/DESIGN.md` and `mobile/DESIGN.md` (each opens
  with the owner's standard) are guidance, not a cage. When doing better means going beyond or against
  them, say so once, before doing it; if it turns out better, update the DESIGN.md too.
- **Testing, web and app (owner, 13 Nov).** Test only when it can be done quickly, reliably, and without
  unnecessary token or resource use. Before testing, be clear what the expected outcome is and that your
  reading matches what the owner wants. If anything is ambiguous, ask first, or hand the test to the
  humans with exactly what to check and how. Never test on an assumption that could check the wrong thing
  or give a misleading result. The aim is quality without wasting tokens and resources on
  miscommunication or unnecessary tests. This replaces the older blanket rules that Claude never
  verifies UI itself (`mobile/CLAUDE.md` "Workflow", `frontend/CLAUDE.md` §2.4, §14, §16): when a quick,
  reliable check exists, do it; otherwise hand over a checklist.
- The ownership split, the database rules below and the changelog protocol are **not** design rules:
  they still hold.

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

