select
  p.oid::regprocedure as signature,
  p.prosecdef         as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_user_inbox';

| signature                                             | security_definer |
| ----------------------------------------------------- | ---------------- |
| get_user_inbox(uuid,integer,timestamp with time zone) | false            |

select p.oid::regprocedure as signature, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_user_inbox';

| signature                                             | proacl                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| get_user_inbox(uuid,integer,timestamp with time zone) | {postgres=X/postgres,service_role=X/postgres} |