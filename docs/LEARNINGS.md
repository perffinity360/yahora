# Yahora — Engineering Learnings

Concepts we met while building Yahora, explained from scratch.
Newest entries at the top.

Written for someone with under a year of experience. No prior knowledge assumed. Every worked
example uses **our** tables, not a generic `foo`/`bar` one.

> Adding an entry: copy the template below, put it at the top, date it. Don't pad the file — if
> nothing new came up in a task, add nothing.

```markdown
## [Date] — Concept name

**Where it came up:** (the actual task)

**The problem:** (what went wrong or what we didn't understand)

**The concept:** (plain-English explanation, assume no prior knowledge)

**Worked example:** (concrete code/SQL showing it)

**Rule of thumb:** (when to reach for this in future)

**Read more:** (one or two links)
```

---

## 2026-08-11 — `PUBLIC` is not "everyone else", and why our REVOKE did nothing

**Where it came up:** `supabase/migrations/20260809141828_performance_and_grants.sql`. We wrote
three `REVOKE ALL ON FUNCTION ... FROM anon` statements to stop the anon role calling functions
that delete accounts and edit like counters. They ran without error and changed nothing.

**The problem:**
- The migration applied cleanly. No warning, no error, no output.
- `anon` could still execute all three functions afterwards.
- A `REVOKE` that does nothing looks *identical* to a `REVOKE` that works. This is the trap.

**The concept:**
- In PostgreSQL, permission on an object is a list of grants: *this role may do this thing*.
- There is one special entry in that list called **`PUBLIC`**. It is not a role you can log in
  as and it is not a group you add members to. It means **"every role, including ones that
  don't exist yet"**. Every role's effective permissions are `(what it was granted directly)`
  **plus** `(what PUBLIC was granted)`.
- **When you `CREATE FUNCTION`, PostgreSQL automatically grants `EXECUTE` on it to `PUBLIC`.**
  You don't write this and you don't see it. It is the default, and it applies to every function
  in our database. (Tables are the opposite — a new table grants nothing to anyone.)
- `REVOKE` only removes **the exact grant you name**. `REVOKE ... FROM anon` removes anon's
  direct grant. It does not, and cannot, remove the `PUBLIC` grant that anon *also* inherits.
- So after our revoke, anon's access came from a path we never touched:

  ```
  anon's EXECUTE on cleanup_demo_users()
    ├── direct grant to anon        ← we revoked this one ✅
    └── grant to PUBLIC (automatic) ← still there, still works ❌
  ```

- The fix is to revoke from `PUBLIC` itself. **This is safe for roles we still want to have
  access**, as long as they hold an *explicit* grant: revoking from `PUBLIC` never touches a
  grant made to a named role. Our baseline migration says
  `GRANT ALL ON FUNCTION public.cleanup_demo_users() TO service_role`, so service_role keeps
  working, and the demo-cleanup cron in `backend/src/utils/cronJobs.js` — which uses the
  service-role client — is unaffected.
- The general shape: **`REVOKE FROM PUBLIC` first, then `GRANT` back to exactly who needs it.**
  Locking down and then opening up is safe. Opening up and then trying to subtract is what bit
  us here.

**Worked example:**

```sql
-- ❌ WRONG — this is what we shipped first. Applies cleanly. Does nothing.
REVOKE ALL ON FUNCTION public.cleanup_demo_users() FROM anon, authenticated;
```

```sql
-- ✅ RIGHT — take it from PUBLIC, which is where the privilege actually lives.
REVOKE ALL ON FUNCTION public.cleanup_demo_users()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_likes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_likes(uuid) FROM PUBLIC;
```

**Never assume a GRANT/REVOKE worked — ask the database.** `has_function_privilege()` answers
the real question ("could this role actually call it?"), inherited grants included:

```sql
SELECT p.proname,
       has_function_privilege('anon',         p.oid, 'EXECUTE') AS anon,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('cleanup_demo_users', 'increment_product_likes');
```

Run against our local DB after `supabase db reset`, this now returns:

```
cleanup_demo_users      | f | t     ← anon locked out, cron still works
increment_product_likes | f | t
```

Before the `FROM PUBLIC` fix, the `anon` column read `t` on both — with the "wrong" migration
above already applied.

**Why this one mattered.** `cleanup_demo_users()` is `SECURITY DEFINER` and deletes rows from
`auth.users`. The anon key is public — it ships inside our JS bundle and our Expo app, and any
student can read it out of DevTools. "anon can execute this" meant anyone on the internet could
delete demo accounts with a single `rpc()` call.

**Rule of thumb:**
- Every new function starts life callable by **everyone**. Assume it until you've checked.
- To lock a function down: `REVOKE ALL ... FROM PUBLIC`, then `GRANT EXECUTE TO <role>` for the
  roles that genuinely need it. In that order.
- `REVOKE FROM anon` is almost always the wrong statement. `anon` rarely has the grant that's
  letting it in.
- **A permission change that produces no error has not been verified.** Confirm with
  `has_function_privilege()` / `has_table_privilege()` on the local DB before pushing.
- Same reasoning applies to `ALTER DEFAULT PRIVILEGES` — if you don't set defaults, every future
  function repeats this by itself.

**Read more:**
- https://www.postgresql.org/docs/current/sql-grant.html — see the note on PUBLIC and functions
- https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE

---

## 2026-08-09 — Database indexes, and why a UNIQUE index is also a lookup index

**Where it came up:** Phase 1, migration `002_usernames.sql`. We add three separate indexes to
`users.username` and it isn't obvious why one isn't enough.

**The problem:**
- We assumed "the column is unique, so lookups are fast" and "one index per column is plenty".
- Both are half-true, and the half that's wrong makes `LIKE 'rah%'` scan every row in the table.

**The concept:**
- A table is a pile of rows in no useful order. Finding `username = 'rahul'` means reading
  every row and checking — a **sequential scan** (or "seq scan"). 10 users: instant. 100,000
  users: slow, and it gets slower forever.
- An **index** is a second, sorted copy of just that column, plus a pointer to the full row.
  Sorted means Postgres can binary-search it — an **index scan**. Same speed at 100 rows and
  100,000 rows.
- **A `UNIQUE` index does two jobs at once.** To reject a duplicate, Postgres has to check "does
  this value already exist?" — which needs a sorted structure. That same structure is what
  serves your `WHERE username = 'rahul'` lookup. **You do not need a second index for lookups.**
- Indexes are not free:
  - Every `INSERT`/`UPDATE`/`DELETE` must update every index on that table. More indexes = slower writes.
  - Each index takes disk space.
  - So: index what you actually filter, sort, or join on. Not every column.
- **An index only helps if the query can use it.** This is the part that surprises people:
  - `WHERE username = 'rahul'` → uses `users_username_key`. ✅
  - `WHERE username LIKE 'rah%'` → **cannot** use it. ❌ Postgres sorts text using your
    database's language collation (the rules that decide whether `á` comes before `b`).
    `LIKE` prefix matching needs plain byte-order sorting instead. Different sort order,
    different index. That's what `text_pattern_ops` builds.
  - `WHERE username % 'rahl'` (fuzzy, typo-tolerant) → needs a third kind, a GIN trigram index.
- **Partial indexes** — a Postgres speciality worth knowing. `CREATE INDEX ... WHERE <condition>`
  indexes only the rows matching the condition. A student with 50,000 read notifications and 3
  unread has a **3-entry** index for the unread badge.

**Worked example:**

```sql
-- migration 002 — three indexes on ONE column, each for a different query shape

-- 1. Uniqueness AND fast exact lookup, in one index.
CREATE UNIQUE INDEX users_username_key ON users (username);
--    serves: WHERE username = 'rahul'

-- 2. Byte-order sorting, so prefix search can use an index.
CREATE INDEX users_username_prefix_idx ON users (username text_pattern_ops);
--    serves: WHERE username LIKE 'rah%'     (the search-as-you-type box)

-- 3. Trigram index, so "rahl" still finds "rahul".
CREATE INDEX users_username_trgm_idx ON users USING GIN (username gin_trgm_ops);
--    serves: WHERE username % 'rahl'

-- A partial index — migration 006. Only unread rows are stored.
CREATE INDEX notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;
--    serves: GET /api/notifications/unread-count, polled every 60s by every client

-- A composite partial index — migration 007. Column ORDER matters: filter first, sort last.
CREATE INDEX posts_home_feed_idx ON posts (university_id, created_at DESC)
  WHERE parent_post_id IS NULL AND moderation_status = 'active';
--    serves the whole campus feed query in one index scan
```

Check your work — run this against any query you care about:

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE username = 'rahul';
-- want to see:  Index Scan using users_username_key
-- red flag:     Seq Scan on users
```

**Rule of thumb:**
- Index the columns you `WHERE`, `ORDER BY`, or `JOIN` on. Not the rest.
- A `UNIQUE` constraint already gives you the lookup index — don't add a duplicate.
- Changing the *shape* of a query (`=` → `LIKE` → fuzzy) can need a different *kind* of index.
- Before shipping any list endpoint: `EXPLAIN ANALYZE` it. **Index Scan** good, **Seq Scan** bad.
- Seq scans on a 50-row dev database look instant. That's the trap — they only hurt in production.

**Read more:**
- https://www.postgresql.org/docs/current/indexes-intro.html
- https://use-the-index-luke.com/ — the best free explanation of indexes anywhere

---

## 2026-08-09 — Race conditions, and why "check then insert" is never safe

**Where it came up:** Phase 1 usernames (§1.1 Problem 2). Two students pick `rahul` at the
same moment. Also already present as a live bug in `POST /api/products/:id/like`.

**The problem:**
- The obvious code is: *ask if the username is free → if yes, save it.*
- That code is wrong, and no amount of extra checking fixes it.

**The concept:**
- A **race condition** is when the result depends on the timing of two things running at once.
- Your server handles many requests **simultaneously**. Two students can be inside the same
  function at the same instant.
- "Check then act" has a **gap** between the check and the act. Someone else can act inside
  your gap. The formal name is **TOCTOU** — time-of-check to time-of-use.
- Walk it through:

  | Time | Student A | Student B |
  |---|---|---|
  | 1 | asks: is `rahul` free? | |
  | 2 | | asks: is `rahul` free? |
  | 3 | database says **yes** | |
  | 4 | | database says **yes** |
  | 5 | saves `rahul` ✅ | |
  | 6 | | saves `rahul` 💥 |

- Both saw a true answer. Both acted correctly on it. You still got two people with one handle.
- **The fix is not more checking.** Checking twice just makes the gap smaller. The fix is to let
  the **database** decide, because it can check-and-write as one indivisible operation that no
  other request can interleave with.
- So: attempt the write, and **handle the failure**. The `UNIQUE` index rejects the second
  writer with Postgres error code **`23505`** (unique violation). Catching `23505` is what
  actually protects you.
- The upfront availability check is still worth having — **but only as a nicety for the UI**, so
  the student sees a red tick while typing rather than an error after submitting. It is not the
  safety mechanism. Never treat it as one.

**Worked example:**

```js
// backend/src/modules/auth/auth.controller.js — the real fix from §1.4

// The nice-to-have: gives the UI a live green/red tick. NOT the protection.
const { data: free } = await supabase
  .rpc('is_username_available', { p_username: username, p_user_id: userId });
if (!free) return sendError(res, 400, 'USERNAME_TAKEN');

// The actual protection: attempt the write, handle the collision.
const { data, error } = await supabase
  .from('users')
  .update({ username: username.toLowerCase().trim() })
  .eq('id', userId)
  .select()
  .single();

if (error) {
  if (error.code === '23505') {                 // ← the unique index rejected us
    return sendError(res, 400, 'USERNAME_TAKEN');
  }
  throw error;
}
```

We have this bug live right now, in Part 1:

```js
// backend/src/modules/products/products.controller.js — toggleLikeProduct
const { data: existingLike } = await supabase   // ← CHECK
  .from('product_likes').select('*')
  .eq('user_id', user_id).eq('product_id', product_id).single();

if (existingLike) { /* delete */ }
else { await supabase.from('product_likes').insert([{ user_id, product_id }]); }  // ← ACT
```

Double-tap the heart fast enough and both requests see "not liked", both insert, and the second
fails on the `(user_id, product_id)` primary key. The insert result is never checked, so the API
returns **200 `is_liked: true`** for a like that does not exist. Plan §6.6 fixes this shape by
making post likes a **separate POST and DELETE** instead of a toggle — retrying a `POST` is then
safe and simply returns `DUPLICATE`.

**Rule of thumb:**
- **Never let a `SELECT` decide whether an `INSERT`/`UPDATE` is safe.** Let the constraint decide
  and handle the error.
- If a rule must never be broken, it belongs in the database as a `UNIQUE` index, a `CHECK`, or a
  trigger — not in an `if` statement.
- Always check the result of a write. An unchecked insert is a lie waiting to reach the client.
- Prefer designs where retrying is harmless (**idempotent**). A separate POST/DELETE pair is
  idempotent; a toggle is not.
- You will not reproduce this locally by clicking. It needs two requests in the same millisecond.
  Assume it exists and code for it.

**Read more:**
- https://www.postgresql.org/docs/current/mvcc.html
- https://www.postgresql.org/docs/current/errcodes-appendix.html — where `23505` comes from

---

## 2026-08-09 — What `ON DELETE CASCADE` actually does to your data

**Where it came up:** `DELETE /api/products/:id` is four lines long and deletes far more than
four lines' worth of data. Nothing in the JavaScript says so.

**The problem:**
- We wrote "delete the product". We did not realise we had also written "delete every comment,
  like, save and purchase record attached to it, and quietly break its chat threads".
- None of that appears in the controller. It is all in the schema.

**The concept:**
- A **foreign key** is a column pointing at another table's row — `comments.product_id` points at
  `products.id`. It means "this comment belongs to that product".
- When the target row is deleted, Postgres must do *something* with the rows pointing at it. You
  choose what, when you create the foreign key:

  | Setting | What happens when the parent is deleted |
  |---|---|
  | `ON DELETE CASCADE` | The child rows are **deleted too**. Silently. |
  | `ON DELETE SET NULL` | The child rows **survive**, with the pointer set to `NULL`. |
  | `ON DELETE RESTRICT` | The delete is **refused** while children exist. |
  | *(nothing specified)* | Same as `RESTRICT` — you get a foreign-key error. |

- **CASCADE is recursive.** Deleting a user cascades to their products, and those products
  cascade to their comments, and so on down the tree. One statement, an unbounded amount of data.
- **There is no undo, no confirmation, and no log.** It does not go through your code.
- **`SET NULL` is not automatically safer** — it leaves behind rows that are still there but no
  longer reachable, which is its own kind of bug (see the worked example).

**Worked example:**

```sql
-- What our schema actually says (supabase/migrations/..._remote_schema.sql)

ALTER TABLE comments      ADD CONSTRAINT comments_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_likes ADD CONSTRAINT product_likes_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_saves ADD CONSTRAINT product_saves_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE purchases     ADD CONSTRAINT purchases_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE messages      ADD CONSTRAINT messages_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;  -- ← different!

ALTER TABLE users         ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

So this controller:

```js
// backend/src/modules/products/products.controller.js — the ENTIRE delete
await supabase.from('products').delete().eq('id', id);
```

…actually performs: delete the product **+ all its comments + all its likes + all its saves +
all its purchase records**, and sets `product_id = NULL` on every chat message about it.

**The `SET NULL` one is the nastiest, because it fails silently.** Our inbox RPC does this:

```sql
-- get_user_inbox() — note JOIN, which is an INNER join
FROM RankedMessages rm
JOIN users    u ON u.id = rm.chat_partner_id
JOIN products p ON p.id = rm.product_id      -- ← rows with NULL product_id are dropped here
```

An inner join drops rows that don't match. So after a product is deleted, its conversations
**vanish from both users' inboxes** — but the messages still exist in the table. No error, no
empty state, just a chat that silently disappeared. Nobody would find that from reading the
delete endpoint.

Deleting a `users` row is bigger still: it cascades into products → comments/likes/saves/
purchases, plus messages (both `sender_id` and `receiver_id`), plus follows, blocks and
notifications once those exist.

**Rule of thumb:**
- Before writing any `DELETE`, list every foreign key pointing **at** that table and read its
  `ON DELETE` rule. The blast radius is in the schema, never in your code.
- For **user-generated content, prefer a soft delete** — that's why moderation sets
  `posts.moderation_status = 'removed'` instead of deleting. §6.3: *"You will want this if a
  college administration ever contacts you about something a student posted."*
- `CASCADE` is right for rows that are meaningless without their parent (a like on a deleted
  product). It is wrong for anything you might need later.
- `SET NULL` demands that you check every query joining that column. An inner join turns
  "nullable" into "invisible".
- Test a delete on a **local** database (`supabase start`) with realistic data, then count the
  rows in every related table.

**Read more:**
- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

---

## 2026-08-09 — Row Level Security: the anon key vs the service-role key

**Where it came up:** Phase 3 §3.3. We were about to write RLS policies believing they would
protect our Express endpoints. They do not, and believing they do is how you ship a data leak.

**The problem:**
- We thought: "RLS is on, so the database will stop anyone reading another campus's data."
- Our backend bypasses RLS completely. It has done since day one.

**The concept:**
- **Row Level Security (RLS)** is a Postgres feature: a per-table rule deciding *which rows* a
  given user may see or change. Not which tables — which **rows**. The filter is applied by the
  database, on every query, whether or not your code remembered to add a `WHERE`.
- Supabase gives you **two keys**, and this is the whole lesson:

  | | **anon key** | **service-role key** |
  |---|---|---|
  | Where it lives | Shipped inside the website and app | Server only, in `.env`, never in a client |
  | Is it secret? | **No.** Anyone can read it out of your JS bundle | **Yes.** Leaking it is a total compromise |
  | RLS | **Enforced** on every query | **Bypassed entirely** |
  | Who we use it as | `frontend/src/config/supabaseClient.js`, mobile | `backend/src/config/supabase.js` |

- Our Express backend uses the **service-role key**. Therefore:
  - **RLS does nothing for any `/api/*` route.** The backend can read and write anything.
  - Your controller is the *only* thing standing between a caller and the data.
- So why write policies at all? **Because the client talks to Supabase directly too.** In our
  app that means **Realtime** (live chat updates) and **Storage** (images). Those paths use the
  anon key, and RLS is the only thing protecting them.
- And the anon key is public. A student can open DevTools, copy it out of the bundle, and run
  their own queries from a script. **RLS is what makes that return only what they're allowed to
  see** instead of every message on every campus.
- Two different jobs, both required:
  - **Controller checks** protect `/api/*`.
  - **RLS policies** protect the direct-Supabase path.
  - Neither substitutes for the other.

**Worked example:**

```js
// backend/src/config/supabase.js — the service-role client. Bypasses RLS.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey, { /* ... */ });
```

```js
// So THIS is a data leak, even with perfect RLS policies in place:
export const getDashboardData = async (req, res) => {
  const { userId } = req.params;                       // ← from the URL. Not verified.
  const { data: profile } = await supabase
    .from('users').select('*').eq('id', userId).single();
  res.json({ profile /* ... */ });
};
// Anyone can call GET /api/user/<any-uuid>/dashboard and read that person's
// private dashboard. RLS never runs. This is live in our Part 1 code today.

// The fix is in the controller, not the database:
if (userId !== req.user.id) return sendError(res, 403, 'FORBIDDEN');
```

```sql
-- And this is what protects the OTHER path — a student querying with the anon key.
-- migration 008. Without it, `SELECT * FROM posts` from a browser console
-- returns every post from every college.
CREATE POLICY posts_select ON posts FOR SELECT TO authenticated
USING (
  moderation_status = 'active'
  AND (scope = 'global'
       OR university_id = (SELECT university_id FROM users WHERE id = auth.uid()))
  AND NOT is_blocked_pair(auth.uid(), posts.author_id)
  AND can_view_social_content(auth.uid(), posts.author_id)
);
```

Note `auth.uid()` — inside a policy, that is the logged-in user from their JWT. The database
knows who is asking. That is why the rule can live there and cannot be forged by the client.

One more sharp edge worth knowing:

```sql
-- Only the BLOCKER can read a block row. The blocked person cannot query the
-- table to discover they were blocked — which is why blocking works as a
-- safety feature at all.
CREATE POLICY blocks_select ON blocks FOR SELECT TO authenticated
USING (blocker_id = auth.uid());
```

**Rule of thumb:**
- Ask "**which key is this query using?**" before reasoning about who can see what.
- Service-role → **you** are the security. Check ownership and campus in the controller, using
  `req.user.id` from `requireAuth`, **never** a `user_id` from the request body.
- Anon key → **RLS** is the security. Write the policy.
- Write both. They defend different doors.
- The service-role key must never appear in `frontend/` or `mobile/`, in a commit, or in a log.
- Audit with: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
  Any `false` is a table readable by anyone holding the anon key.

**Read more:**
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

## 2026-08-09 — Cursor pagination vs offset pagination

**Where it came up:** Phase 3 §3.2, and every list endpoint in `API.md` Part 2 — followers,
following, feeds, replies, notifications.

**The problem:**
- "Page 3" is the obvious way to paginate. It is wrong in two ways that both get worse as the
  app grows, and one of them loses data without any error.

**The concept:**
- **Offset pagination** — `LIMIT 30 OFFSET 60` for page 3. Two problems:
  1. **It gets slower the deeper you go.** `OFFSET 100000` makes Postgres find and then *throw
     away* 100,000 rows before returning anything. The work is proportional to how far in you are.
  2. **Rows shift underneath the reader.** This is the one that actually loses data:

     | | |
     |---|---|
     | You load page 1 | rows 1–30 |
     | Someone follows Rahul | everything shifts down by one |
     | You load page 2 (`OFFSET 30`) | starts at what *was* row 29 |
     | Result | **row 30 is skipped entirely.** No error. |

     A delete does the opposite and shows you a duplicate.
- **Cursor pagination** asks a different question. Not *"give me rows 61–90"* but **"give me the
  next 30 items *after this specific item*"**.
  - The "cursor" is a value from the **last row you received** — usually its `created_at`.
  - The next request says `WHERE created_at < '2026-07-28T14:22:11Z' ORDER BY created_at DESC LIMIT 30`.
  - Insertions and deletions elsewhere in the list cannot shift your position, because your
    position is a *value*, not a *count*.
  - It's the same speed at item 1 and item 100,000, because the index seeks straight to the
    cursor instead of counting from the start.
- The trade-off: **you cannot jump to page 7.** You can only go forwards. For a feed, that is
  exactly what you want — it is what "infinite scroll" is.
- `next_cursor: null` means the end. It is the only end-of-list signal.

**Worked example:**

```sql
-- Followers list, §3.2. $2 is the cursor — NULL on the first request.
SELECT ... FROM follows
WHERE following_id = $1 AND status = 'accepted'
  AND ($2::timestamptz IS NULL OR created_at < $2)
ORDER BY created_at DESC
LIMIT 30;
```

```sql
-- The index that makes it a straight seek rather than a scan.
-- Filter columns first, sort column last, in the same direction as the ORDER BY.
CREATE INDEX follows_following_idx ON follows (following_id, status, created_at DESC);
```

```js
// backend/src/utils/respond.js — every list endpoint returns this envelope
export function sendPage(res, items, cursorField = 'created_at', limit = 20) {
  const next = items.length === limit ? items[items.length - 1][cursorField] : null;
  return res.json({ items, next_cursor: next });
}
// If we got a full page, there may be more → hand back the last row's cursor.
// If we got fewer than `limit`, we've reached the end → null.
```

```js
// The client just echoes it back. It never builds a cursor itself.
const first  = await api.get('/users/123/followers');
const second = await api.get(`/users/123/followers?cursor=${first.next_cursor}`);
```

**⚠️ Our three feeds use three different cursor types.** This is the sharpest edge in our API,
because getting it wrong produces a *valid query that returns the wrong rows* — no error, just
silently missing posts:

| Feed | Cursor is | Comparison |
|---|---|---|
| `/posts/feed/campus` | `created_at` timestamp | `created_at < cursor` |
| `/posts/feed/following` | `created_at` timestamp | `created_at < cursor` |
| `/posts/feed/global?sort=hot` | `hot_score` **float** | `hot_score < cursor` |
| `/posts/feed/global?sort=new` | **epoch seconds** | `EXTRACT(EPOCH FROM created_at) < cursor` |

And `/posts/:id/replies` runs the other way — replies are shown **oldest first**, so its
comparison is `created_at > cursor`. Copying the `<` from the feeds returns an empty second page.

This is exactly why the rule is **echo `next_cursor` back verbatim, never construct or parse it**.
Treat it as an opaque token even though today it happens to look like a date.

**Rule of thumb:**
- Cursor pagination for **every** list in this project. No exceptions, no page numbers.
- The cursor column must be the column you `ORDER BY`, and it must be **unique or
  near-unique** — ties at the boundary can drop or repeat a row. `created_at` at our volume is
  fine; add the `id` as a tiebreaker if that ever changes.
- Build the matching index, filter columns first and the sort column last.
- Cap `limit` server-side (we cap at 50). An uncapped `?limit=999999` is a denial-of-service.
- `next_cursor: null` is the end. Don't invent another signal.
- Offset is still fine for a small admin table where you genuinely want page numbers and the
  data barely changes.

**Read more:**
- https://use-the-index-luke.com/no-offset
- https://www.postgresql.org/docs/current/queries-limit.html
