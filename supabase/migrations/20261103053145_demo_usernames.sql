-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-B · Migration 4 of 4 — demo. usernames
--
-- Runbook §1.11. A demo account's username always starts with 'demo.', and a real
-- student's never starts with demo. demo- or demo_, so no real student ever looks
-- like a demo. Plain 'demo...' stays legal: democrat, demon and demolition are
-- real names.
--
--   1. Rename existing demo accounts, and free their old names.
--   2. A trigger enforces the rule both ways, on every write.
--   3. is_username_available() gives the same answer before the write.
--   4. generate_demo_username() names a new demo account at login.
--
-- ⚠ Until Block V-C merges, demo onboarding still asks for a username and
-- seedDemo.js still writes persona handles like rahul.sharma. Both are refused
-- once this applies, so Block V-C has to change both.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. Existing demo accounts. This runs before the trigger exists, though it would
--    pass anyway. trg_record_username_change writes each old name to
--    username_history, so the delete has to come after the rename.
--
--    rahul.sharma becomes demo.rahul.sharma, so the personas' names still read
--    well in a demo, and match what seedDemo.js writes from Block V-C on. A name
--    that wouldn't fit in 25 characters, or that someone already holds, gets a
--    hash instead. A username always starts with a letter, so the dot can't form
--    a double separator.
-- ---------------------------------------------------------------------------
update public.users u
   set username = case
         when char_length('demo.' || u.username) <= 25
          and not exists (select 1 from public.users other where other.username = 'demo.' || u.username)
           then 'demo.' || u.username
         else 'demo.' || substr(md5(u.id::text), 1, 8)
       end
  from public.universities un
 where un.id = u.university_id
   and un.is_demo
   and u.username is not null
   and u.username not like 'demo.%';

delete from public.username_history h
 using public.users u, public.universities un
 where u.id = h.user_id
   and un.id = u.university_id
   and un.is_demo;

-- ---------------------------------------------------------------------------
-- 2. The rule, both ways
--
-- Declared like its neighbours check_username_not_reserved and
-- record_username_change: SECURITY INVOKER with a pinned search_path. GoTrue
-- reaches public.users only through handle_new_user(), which is SECURITY DEFINER
-- and inserts username NULL, so this trigger does not even fire there. Migration
-- 011 records the same reasoning for those two.
--
-- BEFORE triggers fire in name order. On public.users that is:
--   trg_record_username_change   (update only)
--   trg_username_not_reserved
--   trg_username_world_prefix    ← this one, last
-- All three run before users_username_valid, so this one folds case itself.
--
-- A write that changes neither column skips the check: UPDATE OF fires whenever
-- the column is named in the SET list, and a real student who already holds a
-- name like demo-x should not start failing on an unrelated save.
-- ---------------------------------------------------------------------------
create function public.username_breaks_world_rule(p_username text, p_university_id uuid)
  returns boolean
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_is_demo boolean;
begin
  select un.is_demo into v_is_demo
    from public.universities un
   where un.id = p_university_id;

  if coalesce(v_is_demo, false) then
    return lower(p_username) !~ '^demo\.';
  end if;

  return lower(p_username) ~ '^demo[._-]';
end;
$function$;

comment on function public.username_breaks_world_rule(text, uuid) is
  'The one statement of the rule: a demo-campus username must start with demo. and '
  'any other must not start with demo. demo- or demo_. A NULL campus counts as real. '
  'The trigger and is_username_available() use it, and the backend calls it to name '
  'the reason for a refusal, so nothing restates the rule in JavaScript.';

create function public.check_username_world_prefix()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'UPDATE'
     and new.username is not distinct from old.username
     and new.university_id is not distinct from old.university_id then
    return new;
  end if;

  if public.username_breaks_world_rule(new.username, new.university_id) then
    raise exception 'USERNAME_RESERVED' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

comment on function public.check_username_world_prefix() is
  'BEFORE INSERT OR UPDATE on users: raises USERNAME_RESERVED when '
  'username_breaks_world_rule() says so.';

create trigger trg_username_world_prefix
  before insert or update of username, university_id on public.users
  for each row
  when (new.username is not null)
  execute function public.check_username_world_prefix();

-- ---------------------------------------------------------------------------
-- 3. is_username_available: the same rule, before the write. CREATE OR REPLACE
--    keeps its grants, and everything from migration 009 is unchanged except the
--    new block and its one variable.
--
--    Without a p_user_id there's no account to look at, so the caller is treated
--    as a real student. generate_demo_username() doesn't go through this function.
-- ---------------------------------------------------------------------------
create or replace function public.is_username_available(
  p_username text,
  p_user_id  uuid default null
)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $function$
declare
  u text := lower(trim(p_username));
  v_university uuid;
begin
  -- The fold happens FIRST, so this answers "is the handle you would actually
  -- get available?" rather than "did you type it in the right case?". A caps
  -- lock user asking about RAHUL is asking about rahul, and gets a straight
  -- answer instead of a format error they cannot act on. The remaining checks
  -- mirror the users_username_valid CHECK exactly — if the two ever drift,
  -- this function says yes and the insert says no, and the student sees a 500
  -- on a handle we just told them was free.
  if u is null
     or length(u) not between 3 and 25
     or u !~ '^[a-z][a-z0-9._-]*$'
     or u ~ '[._-]{2}'                  -- 009: no two separators in a row
  then
    return false;
  end if;

  -- Phase 7: mirrors trg_username_world_prefix. Answering here matters, because
  -- completeOnboarding sets the password BEFORE its UPDATE, and a refusal from the
  -- trigger at that point would cost the student their session.
  select us.university_id into v_university
    from public.users us
   where us.id = p_user_id;

  if public.username_breaks_world_rule(u, v_university) then
    return false;
  end if;

  -- reserved
  if exists (select 1 from public.reserved_usernames where username = u) then
    return false;
  end if;

  -- already taken by someone else
  if exists (select 1 from public.users
             where username = u
               and (p_user_id is null or id <> p_user_id))
  then
    return false;
  end if;

  -- inside the 30-day cooling-off window after someone released it
  if exists (select 1 from public.username_history
             where username = u
               and reserved_until > now()
               and (p_user_id is null or user_id <> p_user_id))
  then
    return false;
  end if;

  return true;
end;
$function$;

comment on function public.is_username_available(text, uuid) is
  'Answers format + reserved + taken + 30-day cooling-off in one round trip. '
  'Format rule must stay identical to the users_username_valid CHECK: '
  'lowercase, 3-25 chars, ^[a-z][a-z0-9._-]*$, and no two of . _ - adjacent '
  '(added in migration 009). The demo. rule is username_breaks_world_rule(), which '
  'trg_username_world_prefix uses too (added in Phase 7).';

-- ---------------------------------------------------------------------------
-- 4. generate_demo_username
--
-- Every word has at most 7 letters, so the longest name is
-- 'demo.' + 7 + '.' + 7 + '.NN' = 23 characters, inside the 25 limit. Only single
-- dots separate lowercase words, so every name passes users_username_valid.
--
-- 40 × 40 × 100 names is plenty, and accounts are cleaned up nightly. The loop is
-- bounded anyway, because migration 016 fixed an unbounded one that spun until the
-- statement timeout. The hash form is the same one the rename above uses.
-- ---------------------------------------------------------------------------
create function public.generate_demo_username()
  returns text
  language plpgsql
  volatile
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_adjectives constant text[] := array[
    'sunny', 'brave', 'calm', 'clever', 'cosy', 'curious', 'daring', 'eager',
    'fancy', 'gentle', 'golden', 'happy', 'honest', 'jolly', 'kind', 'lively',
    'lucky', 'mellow', 'merry', 'mighty', 'modest', 'nimble', 'noble', 'peppy',
    'plucky', 'polite', 'proud', 'quick', 'quiet', 'rapid', 'shiny', 'silly',
    'sleepy', 'snappy', 'spry', 'steady', 'swift', 'tidy', 'witty', 'zesty'
  ];
  v_animals constant text[] := array[
    'otter', 'panda', 'koala', 'tiger', 'lemur', 'falcon', 'badger', 'beaver',
    'bison', 'camel', 'cheetah', 'dolphin', 'donkey', 'eagle', 'ferret', 'gecko',
    'giraffe', 'hamster', 'heron', 'ibex', 'iguana', 'jackal', 'kitten', 'lizard',
    'llama', 'lynx', 'magpie', 'marmot', 'moose', 'newt', 'ocelot', 'parrot',
    'penguin', 'puffin', 'quail', 'rabbit', 'robin', 'seal', 'turtle', 'walrus'
  ];
  v_name text;
begin
  for v_attempt in 1..200 loop
    v_name := 'demo.'
      || v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int]
      || '.'
      || v_animals[1 + floor(random() * array_length(v_animals, 1))::int];

    if v_attempt > 1 then
      v_name := v_name || '.' || to_char(floor(random() * 100)::int, 'FM00');
    end if;

    if not public.demo_username_is_taken(v_name) then
      return v_name;
    end if;
  end loop;

  loop
    v_name := 'demo.' || substr(md5(gen_random_uuid()::text), 1, 8);
    exit when not public.demo_username_is_taken(v_name);
  end loop;

  return v_name;
end;
$function$;

comment on function public.generate_demo_username() is
  'A free name such as demo.sunny.otter for a new demo account, always within every '
  'username rule. If the name is taken it adds a dot and two digits, and tries again.';

create function public.demo_username_is_taken(p_name text)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select exists (select 1 from public.users u where u.username = p_name)
      or exists (select 1 from public.reserved_usernames r where r.username = p_name)
      or exists (select 1 from public.username_history h
                  where h.username = p_name and h.reserved_until > now());
$function$;

comment on function public.demo_username_is_taken(text) is
  'Taken, reserved, or inside someone''s 30-day cooling-off window. Used only by '
  'generate_demo_username(), because is_username_available() treats a caller with '
  'no account as a real student and refuses every demo. name.';

-- ---------------------------------------------------------------------------
-- 5. Who may run these: the backend only.
-- ---------------------------------------------------------------------------
revoke execute on function public.check_username_world_prefix()           from public, anon, authenticated;
revoke execute on function public.username_breaks_world_rule(text, uuid)  from public, anon, authenticated;
revoke execute on function public.generate_demo_username()                from public, anon, authenticated;
revoke execute on function public.demo_username_is_taken(text)            from public, anon, authenticated;

grant  execute on function public.username_breaks_world_rule(text, uuid)  to service_role;
grant  execute on function public.generate_demo_username()                to service_role;
grant  execute on function public.demo_username_is_taken(text)            to service_role;

commit;
