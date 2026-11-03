-- Phase 7 · V-B · tests for migration demo_usernames. Local database only.
-- Runs in one transaction and rolls back. Every line it prints should end in "ok".
-- It acts as service_role, as the backend does, so a missing grant fails here too.
\set ON_ERROR_STOP on
\set QUIET on

begin;

create function pg_temp.u(p_username text) returns uuid language sql stable as $$
  select id from public.users where username = p_username
$$;

create function pg_temp.fails(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'expected % but got: %', p_expected, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected % but the statement succeeded: %', p_expected, p_sql;
end $$;

-- A student, made the way GoTrue makes one: handle_new_user fills the campus from
-- the email domain, and the username starts empty. This also proves the new
-- trigger doesn't get in the way of a signup.
create function pg_temp.new_user(p_email text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, '',
          now(), now(), now(), '{}', '{}', '', '', '', '');
  return v_id;
end $$;

grant execute on all functions in schema pg_temp to service_role;

select pg_temp.new_user('t4-demo@demo.yahora.com') as demo_id \gset
select pg_temp.new_user('t4-real@iiitk.ac.in')     as real_id \gset
select set_config('t4.demo', :'demo_id', true);
select set_config('t4.real', :'real_id', true);

do $$
begin
  assert (select university_id from public.users where id = current_setting('t4.demo')::uuid)
       = (select id from public.universities where is_demo), 'demo account is not on the demo campus';
  raise notice 'a new account on the demo campus signs up with no username: ok';
end $$;

set local role service_role;

-- ── generate_demo_username ──────────────────────────────────────────────────
do $$
declare v_name text;
begin
  for i in 1..300 loop
    v_name := public.generate_demo_username();
    assert v_name like 'demo.%', 'no prefix: ' || v_name;
    assert char_length(v_name) <= 25, 'too long: ' || v_name;
    assert v_name = lower(v_name) and v_name ~ '^[a-z][a-z0-9._-]*$' and v_name !~ '[._-]{2}', 'format: ' || v_name;
    assert v_name ~ '^demo\.[a-z]+\.[a-z]+$', 'shape: ' || v_name;
  end loop;
  raise notice 'generate_demo_username returns demo.… within every username rule: ok';

  v_name := public.generate_demo_username();
  update public.users set username = v_name where id = current_setting('t4.demo')::uuid;
  assert (select username from public.users where id = current_setting('t4.demo')::uuid) = v_name, 'not saved';
  assert public.demo_username_is_taken(v_name), 'taken';
  raise notice 'a demo account can take a generated name: ok';
end $$;

-- Every plain name taken: it has to add two digits and still find a free one.
reset role;
do $$
declare
  v_adj text[] := array['sunny','brave','calm','clever','cosy','curious','daring','eager','fancy','gentle','golden','happy','honest','jolly','kind','lively','lucky','mellow','merry','mighty','modest','nimble','noble','peppy','plucky','polite','proud','quick','quiet','rapid','shiny','silly','sleepy','snappy','spry','steady','swift','tidy','witty','zesty'];
  v_ani text[] := array['otter','panda','koala','tiger','lemur','falcon','badger','beaver','bison','camel','cheetah','dolphin','donkey','eagle','ferret','gecko','giraffe','hamster','heron','ibex','iguana','jackal','kitten','lizard','llama','lynx','magpie','marmot','moose','newt','ocelot','parrot','penguin','puffin','quail','rabbit','robin','seal','turtle','walrus'];
  a text; b text;
begin
  foreach a in array v_adj loop
    foreach b in array v_ani loop
      insert into public.reserved_usernames (username, reason) values ('demo.' || a || '.' || b, 'system')
      on conflict do nothing;
    end loop;
  end loop;
end $$;
set local role service_role;
do $$
declare v_name text;
begin
  v_name := public.generate_demo_username();
  assert v_name ~ '^demo\.[a-z]+\.[a-z]+\.[0-9]{2}$', 'expected two digits: ' || v_name;
  assert char_length(v_name) <= 25, 'too long: ' || v_name;
  raise notice 'if the name is taken it adds a dot and two digits: ok';
end $$;

-- ── The rule, on the table ──────────────────────────────────────────────────
do $$
declare
  v_real uuid := current_setting('t4.real')::uuid;
  v_demo uuid := current_setting('t4.demo')::uuid;
begin
  perform pg_temp.fails(format($f$update public.users set username = 'demo.x1' where id = %L$f$, v_real), 'USERNAME_RESERVED');
  perform pg_temp.fails(format($f$update public.users set username = 'demo-x1' where id = %L$f$, v_real), 'USERNAME_RESERVED');
  perform pg_temp.fails(format($f$update public.users set username = 'demo_x1' where id = %L$f$, v_real), 'USERNAME_RESERVED');
  raise notice 'a real user can''t take demo.x, demo-x or demo_x: ok';

  perform pg_temp.fails(format($f$update public.users set username = 'DEMO.x1' where id = %L$f$, v_real), 'USERNAME_RESERVED');
  raise notice 'capitals don''t get around it: ok';

  perform pg_temp.fails(format($f$update public.users set username = 'plainname' where id = %L$f$, v_demo), 'USERNAME_RESERVED');
  perform pg_temp.fails(format($f$update public.users set username = 'demo-plain' where id = %L$f$, v_demo), 'USERNAME_RESERVED');
  raise notice 'a demo user can''t take a name without demo.: ok';

  update public.users set username = 'democrat' where id = v_real;
  assert (select username from public.users where id = v_real) = 'democrat', 'democrat';
  update public.users set username = 'demolition' where id = v_real;
  assert (select username from public.users where id = v_real) = 'demolition', 'demolition';
  raise notice 'democrat is still fine for a real user: ok';

  perform pg_temp.fails(format($f$update public.users set university_id = (select id from public.universities where is_demo) where id = %L$f$, v_real), 'USERNAME_RESERVED');
  raise notice 'moving a real name to the demo campus is refused: ok';
end $$;

-- A real student who already held demo-x before this rule keeps working.
reset role;
alter table public.users disable trigger trg_username_world_prefix;
update public.users set username = 'demo-legacy' where id = current_setting('t4.real')::uuid;
alter table public.users enable trigger trg_username_world_prefix;
set local role service_role;
do $$
declare v_real uuid := current_setting('t4.real')::uuid;
begin
  update public.users set username = 'demo-legacy', bio = 'unrelated save' where id = v_real;
  raise notice 'a save that doesn''t change the name isn''t refused: ok';
  perform pg_temp.fails(format($f$update public.users set username = 'demo-other' where id = %L$f$, v_real), 'USERNAME_RESERVED');
  update public.users set username = 'not.a.demo' where id = v_real;
  raise notice 'changing to another demo- name is refused, and a normal name is allowed: ok';
end $$;

-- ── The rule itself, which the backend calls to name a refusal ──────────────
do $$
declare
  v_real_campus uuid := 'a0000000-0000-4000-8000-000000000001';
  v_demo_campus uuid := (select id from public.universities where is_demo);
begin
  assert public.username_breaks_world_rule('demo.x1', v_real_campus), 'demo.x1, real campus';
  assert public.username_breaks_world_rule('demo-x1', v_real_campus), 'demo-x1, real campus';
  assert public.username_breaks_world_rule('demo_x1', v_real_campus), 'demo_x1, real campus';
  assert public.username_breaks_world_rule('demo.x1', null), 'demo.x1, signed out';
  assert not public.username_breaks_world_rule('democrat', v_real_campus), 'democrat, real campus';
  assert not public.username_breaks_world_rule('rahul', null), 'rahul, signed out';
  assert public.username_breaks_world_rule('rahul', v_demo_campus), 'rahul, demo campus';
  assert public.username_breaks_world_rule('demo-x1', v_demo_campus), 'demo-x1, demo campus';
  assert not public.username_breaks_world_rule('demo.x1', v_demo_campus), 'demo.x1, demo campus';
  raise notice 'username_breaks_world_rule answers both ways, and a signed-out caller counts as real: ok';
end $$;

-- ── is_username_available mirrors the trigger ───────────────────────────────
do $$
declare
  v_real uuid := pg_temp.u('arjun.mehta');
  v_demo uuid := current_setting('t4.demo')::uuid;
begin
  assert not public.is_username_available('demo.x1'), 'demo.x1, no account';
  assert not public.is_username_available('demo-x1', v_real), 'demo-x1, real';
  assert not public.is_username_available('demo_x1', v_real), 'demo_x1, real';
  assert not public.is_username_available('DEMO.x1', v_real), 'DEMO.x1, real';
  raise notice 'is_username_available: demo names are unavailable to real users: ok';

  -- Not 'democrat' itself: the test above took it and let it go, so it's inside
  -- the 30-day cooling-off window.
  assert public.is_username_available('democrats', v_real), 'democrats';
  assert public.is_username_available('democrats'), 'democrats, no account';
  raise notice 'is_username_available: a name like democrat is available: ok';

  assert public.is_username_available('demo.free.name', v_demo), 'a free demo. name for a demo user';
  assert not public.is_username_available('plainname', v_demo), 'a plain name for a demo user';
  raise notice 'is_username_available: a demo account gets the opposite answer, as the trigger does: ok';

  assert not public.is_username_available('arjun.mehta', pg_temp.u('priya.nair')), 'taken';
  assert public.is_username_available('arjun.mehta', v_real), 'your own name';
  assert not public.is_username_available('ab'), 'too short';
  assert not public.is_username_available('rahul..sharma'), 'double separator';
  raise notice 'is_username_available: the older rules are unchanged: ok';
end $$;

reset role;

-- ── Existing data ───────────────────────────────────────────────────────────
do $$
begin
  assert not exists (
    select 1 from public.users u join public.universities n on n.id = u.university_id
     where n.is_demo and u.username is not null and u.username not like 'demo.%'
  ), 'a demo account was not renamed';
  raise notice 'no demo account has a name without demo.: ok';
end $$;

-- ── Privileges ──────────────────────────────────────────────────────────────
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    assert not has_function_privilege(r, 'public.generate_demo_username()', 'execute'), r || ' generate';
    assert not has_function_privilege(r, 'public.demo_username_is_taken(text)', 'execute'), r || ' taken';
    assert not has_function_privilege(r, 'public.check_username_world_prefix()', 'execute'), r || ' trigger';
    assert not has_function_privilege(r, 'public.username_breaks_world_rule(text, uuid)', 'execute'), r || ' rule';
  end loop;
  assert has_function_privilege('service_role', 'public.generate_demo_username()', 'execute'), 'service_role';
  assert has_function_privilege('service_role', 'public.username_breaks_world_rule(text, uuid)', 'execute'), 'service_role rule';
  raise notice 'anon and authenticated can''t run the new functions: ok';
end $$;

rollback;
