-- ============================================================================
-- 015. Cursor pagination for get_user_inbox().
--
-- get_user_inbox(p_user_id) returned EVERY conversation a student has, with no
-- limit and no cursor — the inbox equivalent of the uncapped list endpoints in
-- plan §0.5.4. This gives it `p_limit` and `p_cursor`.
--
-- New signature:
--
--   get_user_inbox(p_user_id uuid, p_limit int default 20, p_cursor timestamptz default null)
--
-- One function, one idea. Nothing else in the schema is touched: no table, no
-- policy, no trigger, no other function.
--
--
-- WHY THIS DROPS THE OLD FUNCTION INSTEAD OF REPLACING IT
-- ------------------------------------------------------
-- `CREATE OR REPLACE FUNCTION` only replaces a function with the SAME argument
-- list. Adding two defaulted parameters makes a DIFFERENT function, so a plain
-- CREATE OR REPLACE would leave both versions in the catalogue — and then every
-- existing one-argument call breaks, because both candidates match it:
--
--   ERROR:  function get_user_inbox(uuid) is not unique
--   HINT:   Could not choose a best candidate function.
--
-- That is not a prediction; it was reproduced on this database with a throwaway
-- pair of functions before this migration was written. The backend calls
-- `supabase.rpc('get_user_inbox', { p_user_id })` with one argument, so leaving
-- the old function in place would take the inbox down for both clients the
-- moment this applies.
--
-- So the old signature is dropped and the new one created in the same
-- transaction. Callers passing one argument keep working and pick up the
-- defaults.
--
-- ⚠ CONSEQUENCE FOR TODAY'S CALLERS, STATED PLAINLY: an unchanged caller now
-- receives the newest 20 conversations instead of all of them. The backend
-- controller is NOT updated here (that is Neeraj's block, plan §N-C), so
-- between this migration and that change a student with more than 20
-- conversations sees only the newest 20 in the inbox. Nothing errors, nothing
-- is lost, and older conversations are still reachable through /history — but
-- the list is shorter until the controller passes a cursor. See docs/CHANGELOG.md.
--
--
-- WHAT IS DELIBERATELY PRESERVED
-- ------------------------------
--   · All nine return columns, by name, in order, with identical types. Both
--     the web inbox and the mobile inbox read them by name (backend/API.md,
--     "GET /api/messages/inbox/:userId"). This migration adds no column and
--     renames none.
--   · SECURITY INVOKER. The old function was invoker (pg_proc.prosecdef = f)
--     and this one is too — stated explicitly below rather than left to the
--     default, so a future reader does not have to know what the default is.
--     It is now the SECOND line of defence rather than the only one: EXECUTE is
--     service-role only (see below), and invoker means that even if some future
--     migration widens that grant, the caller still needs SELECT on
--     public.messages and public.users, which `anon` lost in migration 004.
--     Moving this to DEFINER would remove that second line and quietly hand
--     whoever holds EXECUTE the entire messages table.
--   · `SET search_path = public, pg_temp`, per migration 012 and the convention
--     in §5 of 20260812121140. A new function does NOT inherit the old one's
--     proconfig, so this has to be restated here or the pinning silently
--     regresses.
--
-- WHAT CHANGES BESIDES PAGINATION: WHO MAY EXECUTE THIS
-- -----------------------------------------------------
-- The old signature was reachable by PUBLIC, anon, authenticated and
-- service_role — `GRANT ALL ... TO anon` in 20260808143802_remote_schema.sql,
-- plus the EXECUTE that Postgres hands PUBLIC on every new function. A dropped
-- function takes its grants with it, so recreating it is the moment that
-- surface gets decided, and re-granting the old set would have been a decision
-- too, just an unexamined one.
--
-- It is now SERVICE-ROLE ONLY. The sole caller is
-- backend/src/modules/messages/messages.controller.js -> getInbox(), which runs
-- on the service-role client from backend/src/config/supabase.js. No browser
-- and no phone calls this RPC directly: `get_user_inbox` appears nowhere in
-- frontend/src or mobile/src except one type comment. Direct client access is
-- not a use case, so anon and authenticated have no reason to hold EXECUTE.
--
-- The REVOKEs below are guarantees, not undoing of our own grants — this file
-- grants EXECUTE to nobody but service_role. They exist because the resulting
-- ACL would otherwise depend on the target database's ALTER DEFAULT PRIVILEGES,
-- which differs between a local stack and production and is invisible in this
-- file. With them, the outcome is the same everywhere:
--
--     proacl = {postgres=X/postgres,service_role=X/postgres}
--
-- The one thing that changes beyond pagination: the table references in the
-- body are now schema-qualified. Migration 012 flagged this function's
-- unqualified `messages` / `users` / `products` as a latent defect and
-- deliberately did not fix it there, because 012 used ALTER and correcting a
-- body would have defeated the point of that statement. The body is being
-- rewritten here regardless, so it is written correctly.
--
--
-- CAN THIS FAIL AGAINST EXISTING ROWS?
-- ------------------------------------
-- No. It reads no rows and writes none. There is no DDL on any table, no
-- constraint, no index, no backfill, no type change — only DROP FUNCTION and
-- CREATE FUNCTION, whose success depends on the catalogue and not on the
-- contents of messages, users or products. It behaves identically on an empty
-- local database and on production's 141 messages.
--
-- The one non-row risk is a DROP FUNCTION dependency: if anything in the
-- database (a view, another function, a default expression) depended on
-- get_user_inbox(uuid), the DROP would fail and abort the transaction. Nothing
-- does — the only caller is the Express backend over PostgREST, which is not a
-- catalogue dependency. RESTRICT (the default) is relied on rather than CASCADE
-- precisely so that this fails loudly instead of quietly removing a dependent
-- object, should that ever stop being true.
-- ============================================================================

begin;

drop function if exists public.get_user_inbox(uuid);

create function public.get_user_inbox (
  p_user_id uuid,
  p_limit   int         default 20,
  p_cursor  timestamptz default null
)
  returns table (
    contact_id        uuid,
    contact_name      character varying,
    contact_avatar    text,
    product_id        uuid,
    product_title     character varying,
    product_image     text,
    last_message      text,
    last_message_time timestamp with time zone,
    unread_count      bigint
  )
  language plpgsql
  security invoker
  set search_path = public, pg_temp
  as $function$
declare
  -- Clamped here, not trusted from the caller: an uncapped limit is a denial of
  -- service (plan §0.5.4), and the API contract promises the cap is enforced
  -- server-side. 100000 becomes 50; 0 and -1 become 1; NULL becomes the
  -- documented default of 20 rather than tripping LIMIT NULL, which Postgres
  -- reads as "no limit" and would hand back the whole inbox again.
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  return query
  with ranked_messages as (
    select
      m.id, m.content, m.created_at, m.is_read, m.product_id, m.sender_id, m.receiver_id,
      -- Identify who the "other" person in the chat is
      case when m.sender_id = p_user_id then m.receiver_id else m.sender_id end as chat_partner_id,
      row_number() over (
        partition by m.product_id, case when m.sender_id = p_user_id then m.receiver_id else m.sender_id end
        order by m.created_at desc
      ) as rn
    from public.messages m
    where m.sender_id = p_user_id or m.receiver_id = p_user_id
  )
  select
    u.id           as contact_id,
    u.full_name    as contact_name,
    u.avatar_url   as contact_avatar,
    p.id           as product_id,
    p.title        as product_title,
    p.image_urls[1] as product_image, -- Grab just the first image
    rm.content     as last_message,
    rm.created_at  as last_message_time,
    (select count(*) from public.messages m2
     where m2.receiver_id = p_user_id
     and m2.sender_id = u.id
     and m2.product_id = p.id
     and m2.is_read = false) as unread_count
  from ranked_messages rm
  join public.users u on u.id = rm.chat_partner_id
  join public.products p on p.id = rm.product_id
  where rm.rn = 1 -- Only get the latest message per conversation
    -- The cursor is applied AFTER rn = 1, so it filters on the CONVERSATION's
    -- last message time. Pushing it inside the window would instead pick each
    -- conversation's newest message older than the cursor, and every page would
    -- repeat the same conversations with older previews.
    and (p_cursor is null or rm.created_at < p_cursor)
  -- product_id and contact_id are a tiebreak only, so the row order is
  -- deterministic when two conversations share a last_message_time. They are
  -- NOT part of the cursor: the cursor is the timestamp alone, which is what
  -- the caller gets back in last_message_time.
  order by rm.created_at desc, p.id, u.id
  limit v_limit;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Who may execute this: service_role, and nobody else.
--
-- INSIDE the transaction, deliberately. If a REVOKE fails after the CREATE has
-- already committed, the function is live and reachable by whoever the target
-- database's defaults let in, and the migration still reports success. Grants
-- and the object they protect have to land or fail together.
--
-- Three REVOKEs and one GRANT, and the REVOKEs are not undoing anything this
-- file did — no wide grant is ever issued here. Each closes a path by which a
-- role could hold EXECUTE without this file saying so:
--   · PUBLIC        — Postgres grants EXECUTE on every new function to PUBLIC,
--                     and anon/authenticated inherit it.
--   · anon,         — belt and braces for a database whose ALTER DEFAULT
--     authenticated   PRIVILEGES name them for functions in `public`. On this
--                     local stack the default ACL for functions created by
--                     `postgres` is {postgres,service_role}, so these two are
--                     no-ops here; production's defaults are not visible from
--                     this file, and a no-op REVOKE costs nothing.
--
-- Target ACL, asserted by Check 4 of the V-C verification:
--     proacl = {postgres=X/postgres,service_role=X/postgres}
-- ---------------------------------------------------------------------------
revoke execute on function public.get_user_inbox(uuid, integer, timestamptz) from public;
revoke execute on function public.get_user_inbox(uuid, integer, timestamptz) from anon;
revoke execute on function public.get_user_inbox(uuid, integer, timestamptz) from authenticated;
grant  execute on function public.get_user_inbox(uuid, integer, timestamptz) to service_role;

commit;
