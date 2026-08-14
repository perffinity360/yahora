-- ============================================================================
-- Migration 003 — RLS rollout, stage 1
--
-- Locks every table the browser does not touch directly, and closes the
-- default-privilege hole so future tables start closed instead of open.
--
-- OUT OF SCOPE (stage 2, migration 004): public.users, public.messages, and
-- tightening the avatars bucket INSERT policy. All three are blocked on
-- frontend/src/contexts/AuthContext.jsx calling supabase.auth.setSession().
-- Until that lands, web queries run as `anon` with auth.uid() NULL, so
-- auth.uid()-based policies would match nothing for logged-in students.
-- See docs/RLS_SURFACE.md §0.1.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Default privileges — the most important statements in this file.
--
-- The baseline (20260808143802) told Postgres to grant anon/authenticated full
-- access to every table created in `public` from then on. That is a standing
-- instruction: without this revoke, every Phase 1 and community table
-- (follows, blocks, username_history, notifications, reserved_usernames) is
-- born readable, writable and deletable by the public anon key.
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on routines from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Existing table grants.
--
-- Section 1 only affects FUTURE tables, so the 13 that already exist need this
-- explicitly. Today anon holds SELECT, INSERT, UPDATE and DELETE on all of
-- them. After this, anon can write to nothing anywhere.
--
-- users and messages keep SELECT because the web client is unauthenticated and
-- would break immediately otherwise. Migration 004 narrows them once
-- setSession() is in place.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.visitor_metrics to anon, authenticated;
grant select on public.users           to anon, authenticated;  -- 004 narrows
grant select on public.messages        to anon, authenticated;  -- 004 narrows


-- ---------------------------------------------------------------------------
-- 3. RLS on, zero policies, for every table the browser never queries.
--
-- RLS with no matching policy denies by default. service_role has BYPASSRLS,
-- so the Express backend is completely unaffected — these tables keep behaving
-- exactly as they do today.
--
-- products is included: its only client touches are a Realtime subscription
-- (products is not in the supabase_realtime publication, so it delivers
-- nothing) and increment_product_views(), which is SECURITY DEFINER and
-- therefore not subject to caller policies. If products is ever added to the
-- publication, it needs a SELECT policy on the same day.
-- ---------------------------------------------------------------------------

alter table public.universities    enable row level security;
alter table public.courses         enable row level security;
alter table public.specializations enable row level security;
alter table public.products        enable row level security;
alter table public.product_likes   enable row level security;
alter table public.product_saves   enable row level security;
alter table public.purchases       enable row level security;
alter table public.comments        enable row level security;
alter table public.comment_votes   enable row level security;
alter table public.posts           enable row level security;


-- ---------------------------------------------------------------------------
-- 4. visitor_metrics — a single global page-view counter, public by design.
--
-- footer.jsx reads it directly and calls increment_page_view() to bump it,
-- both while logged out. Unlike increment_product_views(), that function is
-- NOT SECURITY DEFINER, so its UPDATE ... RETURNING runs with the caller's
-- permissions and would fail once anon loses UPDATE on the table.
--
-- Making it SECURITY DEFINER is tighter than granting anon UPDATE: the counter
-- keeps working while direct writes to the table stay closed.
-- ---------------------------------------------------------------------------

alter table public.visitor_metrics enable row level security;

create policy visitor_metrics_select_all
  on public.visitor_metrics
  for select
  to anon, authenticated
  using (true);

create or replace function public.increment_page_view()
  returns integer
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $function$
declare
  new_count int;
begin
  update public.visitor_metrics
  set view_count = view_count + 1
  where id = 1
  returning view_count into new_count;

  return new_count;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 5. search_path hardening on the other SECURITY DEFINER functions.
--
-- A SECURITY DEFINER function runs with its owner's privileges. If it names a
-- table without a schema, whoever controls the caller's search_path controls
-- which table it hits. Pinning search_path removes that class of attack, and
-- clears the corresponding Supabase advisor warning.
-- ---------------------------------------------------------------------------

alter function public.cleanup_demo_users()          set search_path = public, pg_temp;
alter function public.increment_product_views(uuid) set search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- 6. Dead code. Zero callers in backend/, frontend/ or mobile/ — the like
--    counters are maintained by trg_update_likes_count instead.
-- ---------------------------------------------------------------------------

drop function if exists public.increment_product_likes(uuid);
drop function if exists public.decrement_product_likes(uuid);


-- ---------------------------------------------------------------------------
-- 7. Storage buckets.
--
-- Buckets are ROWS, not schema, so `supabase db pull` never captured them.
-- Production has four; a fresh local database has none, which is why local
-- uploads behave differently from production. Insert-or-update fixes both at
-- once and makes this testable locally.
--
-- Every bucket currently has file_size_limit = null (no cap) and
-- allowed_mime_types = null (any file type). An HTML file served from your
-- storage domain is a stored-XSS vector; an uncapped bucket is a bill.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',       'avatars',       true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('products',      'products',      true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('posts',         'posts',         true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('yahora videos', 'yahora videos', true, 52428800,  array['video/mp4','video/webm'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 8. The avatars bucket policy, brought into version control AS IT IS.
--
-- This policy exists in production (created in the dashboard) but in no
-- migration, so local and production behave differently — local avatar uploads
-- fail while production's succeed. Capturing it makes the environments match
-- and makes the hole visible.
--
-- KNOWN HOLE, DELIBERATELY LEFT OPEN UNTIL MIGRATION 004: this permits anon to
-- upload. It cannot be tightened to `to authenticated` until AuthContext.jsx
-- calls setSession(), or web onboarding avatar upload breaks. See §0.1.
--
-- yahora videos gets no policy: nothing uploads to it through the API (new
-- marketing videos go in via the dashboard), and public = true is what lets
-- logged-out visitors play them on the home and auth pages.
-- ---------------------------------------------------------------------------

drop policy if exists "Allow public uploads 1oj01fe_0" on storage.objects;

create policy "Avatar uploads"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'avatars');