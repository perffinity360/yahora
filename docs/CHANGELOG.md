# Changelog

How Vishwajeet and Neeraj tell each other what changed.
Newest at top. Every backend/database change gets an entry.

Format: see the six-section template in YAHORA_BUILD_PLAN.md §0.3
Migration requests go under ## MIGRATION REQUESTS (see §0.5.5)

You work in separate Claude Code sessions that cannot see each other. **This file is the
handoff.** A change that isn't written down here did not happen as far as the other person is
concerned. Send the same text on WhatsApp — the file is the record, the message is the ping.

---

## Templates

Copy the right one, fill it in, and paste it under [Entries](#entries) — newest at the top.

### Vishwajeet → Neeraj (a backend or database phase lands)

All six sections are required. The last one — "What NOT to do yet" — is the one people skip
and the one that saves the most time.

```markdown
## 2026-08-XX — Phase N complete (Vishwajeet)

### Migrations applied
- 003_follows.sql   (applied to production at 14:20 IST)

### New endpoints
- POST /api/users/:id/follow      → see API.md §4.1
- DELETE /api/users/:id/follow    → see API.md §4.2

### Changed endpoints (BREAKING)
- GET /api/users/:id now returns `followers_count` and `is_private`.
  Old fields unchanged. Safe to deploy web before mobile.

### New fields on existing responses
- users object now includes: username, followers_count, following_count, is_private

### Test data
- Seeded 30 follow relationships between demo users. Run
  `node backend/scripts/seedDemo.js` to refresh your local data.

### What NOT to do yet
- Don't build the follow-request approval screen. The endpoint exists
  but notifications aren't wired until Phase 5.
```

### Neeraj → Vishwajeet (a backend module lands)

Shorter, but mandatory — Vishwajeet's mobile app consumes it.

```markdown
## 2026-08-XX — social module merged (Neeraj)

### Endpoints now live
- POST/DELETE /api/users/:id/follow
- GET /api/users/:id/followers, /following   (cursor: created_at)
- POST/DELETE /api/users/:id/block
- PATCH /api/users/me/privacy

### Deviations from API.md
- None.                     ← if there ARE any, they go here AND API.md
                              gets updated in the same commit

### Known gaps
- Follow requests return the list but don't emit notifications yet
  (waiting on Phase 5 notify()).

### How I tested it
- Seeded 2 private accounts. Verified pending→accepted transition,
  counter accuracy, and that blocking deletes both follow rows.
```

"Deviations from API.md" is the section that matters most. If you had to change a response
shape mid-implementation, the other person's client is already written against the old one.

---

## Entries

_Newest at the top. Nothing yet._

---

## MIGRATION REQUESTS

Neeraj posts here when he needs a schema change, then messages Vishwajeet. Say what you need,
why, and what it is blocking. Target turnaround: **same day**. If it will take longer, work
around it and revisit.

Vishwajeet replies inline with the migration number once it is applied, and moves the request
under `### Done`.

```markdown
### Open
- **Need:** `users.last_seen_at TIMESTAMPTZ`
  **Why:** the "active recently" badge on profile cards
  **Blocking:** social module follower list
  **Requested:** 2026-08-XX by Neeraj

### Done
- ~~`users.last_seen_at TIMESTAMPTZ`~~ → applied in `011_last_seen.sql`, 2026-08-XX
```

### Open

_Nothing open._

### Done

_Nothing yet._
