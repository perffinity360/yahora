## 2026-10-01 — Phase 6A Block V-A: Search: demo accounts isolated both ways (Vishwajeet → Neeraj)

### Migrations applied
- 20261001122844_search_demo_isolation.sql (018). Local only. **Not yet applied to production.**
  - `public.universities` gains `is_demo boolean`, a STORED generated column:
    `coalesce(domain = 'demo.yahora.com', false)`. Nothing can write it. Every existing
    insert lists its columns, so seed.sql and seedDemo.js are unaffected.
  - `public.search_users()` was replaced with the same signature, return columns, ordering,
    `security invoker` and `search_path`. One lookup now fetches the viewer's campus and
    `is_demo` together. If the lookup finds nothing, the function returns no rows. A new filter
    `and un.is_demo = viewer_is_demo` keeps results in the viewer's world.

### New endpoints
- None.

### Changed endpoints (BREAKING)
- None in shape. GET /api/users/search returns the same `{ items, next_cursor: null }`.
  Behaviour change only:
  - A real student sees only real students, still on every campus.
  - A demo account sees only demo accounts.
  - A viewer with no `users` row, or with `university_id` null, gets an empty list (200).
  - API.md updated under GET /api/users/search.

### New fields on existing responses
- None. `is_demo` is a database column. No endpoint selects it: GET /api/universities lists
  `id, name, domain` explicitly.

### Test data
- After `supabase db reset` plus `node backend/scripts/seedDemo.js`:
  - Arjun Mehta (real, Kurnool) searching "rahul" gets rahul.verma, not rahul.sharma (demo).
  - Rahul Sharma (demo) searching "arjun" gets arjun.singh, not arjun.mehta (real).
  - An unknown or null viewer gets 0 rows.
  - A real student on another campus still shows up: Arjun searching "sneha" finds
    sneha.gupta at NIET.

### What NOT to do yet
- Your controller in `backend/src/modules/user/` is unchanged and needs no change. Keep
  `p_viewer: req.user.id`. Never take the viewer from the query string, because that now
  decides which world a caller searches.
- If the web search UI shows "no results" for a logged-in user, check that the account has a
  `university_id` before suspecting the UI.
- Demo-login rate limiting and captcha are a later phase. Don't build against them yet.
