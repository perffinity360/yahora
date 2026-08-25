-- ============================================================================
-- Migration 004 — RLS rollout, stage 2
--
-- Finishes what 003 deliberately left open: public.users, public.messages, and
-- the avatars bucket INSERT policy. All three were blocked on
-- frontend/src/contexts/AuthContext.jsx calling supabase.auth.setSession() —
-- until that landed, every web query ran as `anon` with auth.uid() NULL, so an
-- auth.uid()-based policy would have matched zero rows for logged-in students
-- and silently emptied the campus switcher and the unread badge.
--
-- ✅ PRECONDITION VERIFIED before this file was written:
--    setSession() is called in AuthContext.jsx at line 136 (boot restore) and
--    line 229 (post-login). Web queries now carry a real JWT and run as
--    `authenticated` with a working auth.uid().
--
--    Verified further: all four direct call sites gate their first query on
--    the `sessionReady` flag (navbar.jsx:189, Marketplace.jsx:475,
--    ProductDetail.jsx:119, Messages.jsx:348). setSession() is async, so a
--    query fired before it resolves would still go out as `anon` and read
--    nothing. That race is already closed on every one of them.
--
-- File number is 004 per docs/PHASE_1_RUNBOOK.md §0.3, even though 005/006/007
-- carry earlier timestamps. Numbers are labels for conversation; timestamps
-- decide apply order. Do not rename anything to force a sequence.
--
-- SELECT ONLY, DELIBERATELY. There are no INSERT/UPDATE/DELETE policies here
-- and none should be added. Every write in this product goes through the
-- Express backend on the service-role key, which has BYPASSRLS — a write
-- policy would widen the surface reachable from the public anon key for no
-- benefit whatsoever. The same reasoning as §3 of migration 003.
--
-- service_role grants are untouched. The backend keeps behaving exactly as it
-- does today.
--
-- Scope evidence: docs/RLS_SURFACE.md §1, §2 and §5, re-derived against the
-- current tree before writing (that document is dated 2026-08-12 and the
-- clients have changed since). The complete set of direct client reads of
-- these two tables is still exactly:
--
--   users     Marketplace.jsx:490   .select('university_id').eq('id', me)
--             ProductDetail.jsx:130 .select('university_id').eq('id', me)
--   messages  navbar.jsx:199        count, .eq('receiver_id', me)
--             navbar.jsx:224        realtime, filter receiver_id=eq.<me>
--             Messages.jsx:352      realtime, UNFILTERED
--             RealtimeContext.tsx:181 (mobile) realtime, UNFILTERED
--
-- No other .from('users') or .from('messages') exists in frontend/src,
-- mobile/src or mobile/app. Both policies below cover every one of them.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. public.users
--
-- Both frontend reads are `.eq("id", currentUserId)` on the caller's own row
-- and select one column, `university_id`, to resolve the student's home campus
-- so the marketplace can tell "my campus" from "browse-only". Own-row SELECT
-- is therefore the entire requirement — nothing on either client reads another
-- student's row directly. Profiles, seller cards and search all go through the
-- backend on the service-role key.
--
-- Effect worth stating plainly: after this, the student directory is
-- unreachable from the publishable key entirely. Today anon can select every
-- row of public.users.
--
-- ⚠️ (select auth.uid()) is wrapped ON PURPOSE and the parentheses are load
-- bearing. Written bare as `id = auth.uid()`, Postgres treats the call as
-- volatile-per-row and re-evaluates it for every row it tests. Wrapped in a
-- scalar subquery it becomes an InitPlan, evaluated ONCE per query and reused.
-- On a table the size a campus directory grows to, that is the difference
-- between an index lookup and a sequential scan. Do not "simplify" it.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;

create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()));

-- The grant 003 left in place with the comment "004 narrows". RLS is what
-- actually gates the rows; removing the grant as well means anon cannot reach
-- the table at all, rather than reaching it and matching no policy. Defence in
-- depth, and a clearer failure if anything is ever mis-wired.
--
-- `authenticated` KEEPS its SELECT grant — the policy above is what limits it
-- to one row. Revoking it here would break the two reads this migration exists
-- to preserve.
revoke select on public.users from anon;


-- ---------------------------------------------------------------------------
-- 2. public.messages
--
-- This one does double duty, and the second job is the important one.
--
-- frontend/src/pages/messages/Messages.jsx:352 opens a postgres_changes
-- subscription on public.messages with NO filter, and decides mine-versus-yours
-- in JavaScript afterwards. mobile/src/contexts/RealtimeContext.tsx:181 does
-- the same. Today, with RLS off, that means the anon key is subscribed to
-- every message row in the database and is merely choosing not to render most
-- of them — anyone with DevTools open could read the whole campus's private
-- conversations off the websocket.
--
-- Supabase Realtime re-checks the SELECT policy for the subscribing role
-- against every changed row before delivering it. So this policy moves that
-- filtering from the client into the database, where it cannot be bypassed,
-- and the unfiltered subscriptions become safe without either client changing
-- a line. public.messages is the only table in the supabase_realtime
-- publication (20260808143802_remote_schema.sql:398), so this is the only
-- place that behaviour applies today.
--
-- A count is a select: navbar.jsx:199 uses `head: true` and returns no
-- columns, but the policy still gates it. With no matching policy it would
-- return 0 rather than an error — a silently-zero unread badge, which is
-- exactly the kind of failure that takes a week to notice.
--
-- Both sides of the OR are needed. sender_id alone would hide every message a
-- student RECEIVED; receiver_id alone would hide their own sent messages from
-- the chat thread they are looking at.
--
-- Same (select auth.uid()) wrapping as §1, for the same reason.
-- ---------------------------------------------------------------------------

alter table public.messages enable row level security;

drop policy if exists messages_select_own on public.messages;

create policy messages_select_own on public.messages
  for select to authenticated
  using (
    sender_id   = (select auth.uid())
    or
    receiver_id = (select auth.uid())
  );

revoke select on public.messages from anon;


-- ---------------------------------------------------------------------------
-- 3. The avatars bucket INSERT policy.
--
-- 003 §8 captured this policy in version control AS IT WAS — `to anon,
-- authenticated` — and labelled it a known hole left open until this
-- migration, because tightening it before setSession() landed would have
-- broken web onboarding's avatar upload.
--
-- Narrowing to `authenticated` is safe now:
--   * web  — the upload runs on the same client instance that setSession() has
--            authenticated, and onboarding.jsx:292 redirects to /auth when
--            there is no stored session, so the page cannot be reached without
--            one (RLS_SURFACE §5.1's "effectively logged out" no longer holds).
--   * mobile — always authenticated; AuthGate only routes into
--            (auth)/onboarding when a session exists (RLS_SURFACE §5.3).
--
-- Only the INSERT path changes. The bucket stays public = true, so reading and
-- displaying avatars is unaffected for logged-out visitors, and getPublicUrl()
-- builds a string client-side without touching the database at all.
--
-- Recreated rather than altered because Postgres has no ALTER POLICY ... TO
-- that can drop a role from the list cleanly.
-- ---------------------------------------------------------------------------

drop policy if exists "Avatar uploads" on storage.objects;

create policy "Avatar uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');


-- ---------------------------------------------------------------------------
-- 4. Two things this migration deliberately does NOT do.
--
-- a) No policy on public.products. The feed, product detail and every other
--    product read is served by the backend over REST. The one direct client
--    touch is ProductCard.jsx:476, a Realtime subscription on a table that is
--    not in the supabase_realtime publication, so it receives nothing today
--    regardless. RLS_SURFACE §0.4 and §3.1 — if products is ever added to the
--    publication it needs a SELECT policy in the same change, or the live
--    view/like counters stay dead and nobody connects the two events.
--
-- b) Nothing about increment_product_views(). ProductCard.jsx:506 calls it
--    from logged-out visitors on the public home page. It is SECURITY DEFINER
--    (20260808143802_remote_schema.sql:178), so its UPDATE runs as the
--    function owner and is not subject to the caller's policies, and EXECUTE
--    was left granted to PUBLIC on purpose. It survives this migration
--    untouched. Noted here so nobody later "fixes" a hole that is a decision.
-- ---------------------------------------------------------------------------
