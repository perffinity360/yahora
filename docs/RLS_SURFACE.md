# RLS Surface — every direct Supabase call from `frontend/` and `mobile/`

**Status:** investigation only, written 2026-08-12. No code changed.
**Purpose:** before enabling Row Level Security on the 13 `public` tables, this is the
complete list of queries that bypass the Express backend and hit Supabase directly with
the **anon key**. Every one of these goes to zero rows / permission-denied the moment RLS
is on unless a policy covers it.

Method: grepped `frontend/src/`, `mobile/src/` **and `mobile/app/`** (Expo Router screens
live outside `src/`, and two of the direct calls are there) for `.from(`, `.rpc(`,
`.storage.from(`, `.channel(`, `.on(` in both quote styles and template literals, then
read the surrounding `useEffect` / `if` guards on every hit to decide logged-in vs
logged-out. Nothing below is inferred from naming.

---

## 0. Read this before you write a single policy

### 0.1 The web app's Supabase client is **never authenticated**

`frontend/src/contexts/AuthContext.jsx` stores the session token in `localStorage`
(`yahora_session`) and **never calls `supabase.auth.setSession()`**. There is no
`supabase.auth.*` call anywhere in `frontend/src/` — the only imports of the client are for
Realtime, storage and the four direct queries listed below.

**Consequence:** every direct web query executes as the Postgres role `anon`, with
`auth.uid()` **NULL** — including queries made by a fully logged-in student. A policy
written as `USING (auth.uid() = user_id)` will match **nothing on web**, for everyone.

Two ways out, and this decision has to be made before the policies are written:

| Option | Effect |
|---|---|
| **A. Fix the client** — call `supabase.auth.setSession()` in `AuthContext.login()` with the tokens `/api/auth/verify-otp` already returns | Web behaves like mobile; `auth.uid()`-based policies work everywhere. Requires a change in `frontend/` (Neeraj's directory). |
| **B. Write anon-permissive policies** for the four web reads | Works without touching client code, but `messages` and `users` would have to be readable by `anon`, which defeats the point of enabling RLS on them. |

Option A is the only one that survives contact with the `messages` table. Recommend A.

### 0.2 Mobile **is** authenticated

`mobile/src/contexts/AuthContext.tsx:112` (`verifyOtp`) and `:124` (`demoLogin`) both call
`supabase.auth.setSession()`. Mobile direct calls run as role `authenticated` with
`auth.uid()` = `users.id`. Mobile makes **no direct table queries at all** — only Realtime
subscriptions and one storage upload.

### 0.3 Realtime is an RLS surface, not a separate system

Supabase Realtime re-checks the `SELECT` policy for the subscribed role against **every
changed row** before delivering it. A `postgres_changes` subscription with no matching
`SELECT` policy goes permanently silent — no error, no callback, just nothing. Three of the
subscriptions below are on `public.messages` and one is on `public.products`.

Presence and broadcast channels (`online-users`, `typing:*`) carry no table rows and are
**not** RLS-gated. They are listed at the end for completeness only.

### 0.4 Only `messages` is actually published to Realtime today

`supabase/migrations/20260808143802_remote_schema.sql:398` is the only
`ALTER PUBLICATION supabase_realtime ADD TABLE` in the repo, and it adds
`public.messages`. The `ProductCard` subscription on `public.products` (§3.1) therefore
receives nothing right now regardless of RLS. If `products` is later added to the
publication, it needs a `SELECT` policy on day one or the live view/like counters stay dead
and nobody will connect the two events.

---

## 1. `public.users` — 2 direct reads, both web only

### 1.1 `frontend/src/pages/marketplace/Marketplace.jsx:481-485`

```js
const { data: userData } = await supabase
  .from("users")
  .select("university_id")
  .eq("id", currentUserId)
  .single();
```

- **Columns:** `university_id`. **Filter:** `id = currentUserId`.
- **Read.**
- **Logged out?** **No.** Wrapped in `if (currentUserId)` at line 480, inside
  `fetchInitialData()`. `currentUserId` is `useState(localStorage.getItem("yahora_user_id"))`
  (line 414). A separate effect at lines 458-465 also redirects to `/auth` when
  `yahora_user_id` or `yahora_session` is missing.
- **Runs as `anon` with `auth.uid()` NULL** (see §0.1). Purpose: resolve the user's *home*
  campus so the campus switcher can tell "browse-only" from "my campus".

### 1.2 `frontend/src/pages/product/ProductDetail.jsx:121-125`

```js
const { data: userData } = await supabase
  .from("users")
  .select("university_id")
  .eq("id", currentUserId)
  .single();
```

- **Columns:** `university_id`. **Filter:** `id = currentUserId`.
- **Read.**
- **Logged out?** **No.** Guarded by `if (currentUserId && !actualHomeUniId)` at line 120;
  `currentUserId = localStorage.getItem("yahora_user_id")` (line 88). Note the route
  `/product/:id` itself is **public** — `App.jsx:110` has no guard and the page renders fine
  logged out. Only this one query inside it is gated.
- Result is written back to `localStorage.yahora_university_id` (line 128).

**Policy needed:** `SELECT (university_id)` on own row. Under Option A that is
`auth.uid() = id`. Under Option B it would mean exposing `users` to `anon`.

---

## 2. `public.messages` — 1 read + 3 Realtime subscriptions

### 2.1 `frontend/src/components/navbar/navbar.jsx:192-196` — unread badge count

```js
const { count } = await supabase
  .from("messages")
  .select("*", { count: "exact", head: true })
  .eq("receiver_id", userId)
  .eq("is_read", false);
```

- **Columns:** none returned (`head: true`) — but a **`SELECT` policy still gates the count**.
  A count is a select; with no policy it returns `0`, not an error.
- **Filter:** `receiver_id = userId AND is_read = false`.
- **Read.**
- **Logged out?** **No.** The effect at line 178 begins
  `if (!isAuthenticated || !userId) { setUnreadCount(0); return; }`.
- Runs as `anon`. **This is the single most visible breakage** if policies are `auth.uid()`-based
  and §0.1 is not fixed: the navbar unread badge silently reads 0 forever.

### 2.2 `frontend/src/components/navbar/navbar.jsx:217-246` — channel `navbar-unread`

```js
supabase.channel("navbar-unread")
  .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages",
        filter: `receiver_id=eq.${userId}` }, …)
  .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages",
        filter: `receiver_id=eq.${userId}` }, …)
  .subscribe();
```

- **Table:** `public.messages`, INSERT + UPDATE, server-side filter `receiver_id=eq.<userId>`.
- **Read** (delivery of changed rows). The INSERT handler then `PUT`s
  `/api/messages/deliver` through the **backend**, which is service-role and unaffected.
- **Logged out?** **No.** Same `isAuthenticated && userId` guard as §2.1 (line 178).
- Needs a `SELECT` policy on `messages` for the subscribing role or the badge stops
  updating live.

### 2.3 `frontend/src/pages/messages/Messages.jsx:343-426` — channel `realtime:messages`

```js
supabase.channel("realtime:messages")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, …)
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, …)
  .subscribe();
```

- **Table:** `public.messages`, INSERT + UPDATE, **no filter** — the client subscribes to
  *every* message row in the table and discards the ones that aren't the current user's in
  JS (lines 355, 362). Comment at line 431 says the empty dep array is deliberate so the
  socket never drops.
- **Read.**
- **Logged out?** **Yes — it subscribes.** The effect (line 341) has an empty dependency
  array and **no auth check at all**; the comment on line 342 says so explicitly. The
  route-level redirect lives in a *different* effect (line 226,
  `if (!currentUserId) return navigate("/auth")`), and effects in the same commit all run
  before the navigation takes effect — so a logged-out visitor to `/messages` opens this
  subscription for at least one render.
- **This is the one to look at hardest.** Today, with RLS off, the anon key is subscribed
  to every message in the database and filters client-side. RLS closes that hole, which is
  good — but it means the policy must be right or logged-in chat breaks too.

### 2.4 `mobile/src/contexts/RealtimeContext.tsx:180-206` — channel `realtime:messages`

```ts
supabase.channel('realtime:messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, …)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, …)
  .subscribe(status => …)
```

- **Table:** `public.messages`, INSERT + UPDATE, **unfiltered** (comment at line 97-98
  explains: a filter would need one channel per user and breaks on re-auth). Mine/not-mine
  is decided in JS at lines 99 and 160.
- **Read.**
- **Logged out?** **No.** `if (!userId) { setConnection('connecting'); return; }` at line
  172, where `userId` comes from `supabase.auth.getSession()` / `onAuthStateChange`
  (lines 62-77) — the Supabase session itself, not app state. Mounted app-wide in
  `mobile/app/_layout.tsx:103`, and `AuthGate` (line 46) bounces sessionless users to
  `/(auth)/login` anyway.
- **Runs as `authenticated` with a real `auth.uid()`.** A policy like
  `auth.uid() IN (sender_id, receiver_id)` works here and, usefully, also replaces the
  client-side filtering.

**Policy needed:** `SELECT` on `messages` where the caller is `sender_id` or `receiver_id`.
Web (§2.1-2.3) will not satisfy it until §0.1 is fixed.

---

## 3. `public.products` — 1 Realtime subscription + 1 RPC

### 3.1 `frontend/src/components/ProductCard/ProductCard.jsx:475-493` — channel `product:${product.id}`

```js
supabase.channel(`product:${product.id}`)
  .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "products",
        filter: `id=eq.${product.id}` },
      payload => { /* reads row.views, row.likes_count, row.comments_count */ })
  .subscribe();
```

- **Table:** `public.products`, UPDATE, filter `id=eq.<product.id>`. Consumes `views`,
  `likes_count`, `comments_count` off the changed row.
- **Read.**
- **Logged out?** **Yes.** The only guard is `if (!supabase || !product.id) return`
  (line 474) — no auth check. `ProductCard` is rendered from `Home.jsx:368`, and `/` is a
  fully public route (`App.jsx:102`). One channel is opened **per rendered card**.
- On `Home` the cards come from the hardcoded `MOCK_LISTINGS` array (`Home.jsx:73`) whose
  ids are strings like `"mock-1"`, not UUIDs — so those subscriptions filter on a
  non-existent id.
- See §0.4: `products` is not in the `supabase_realtime` publication, so this delivers
  nothing today either way.

### 3.2 `frontend/src/components/ProductCard/ProductCard.jsx:506-508` — `rpc("increment_product_views")`

```js
const { error } = await supabase.rpc("increment_product_views", {
  product_id: product.id,
});
```

- **Function:** `public.increment_product_views(uuid)`. **Write** — `UPDATE products SET
  views = COALESCE(views,0)+1 WHERE id = product_id`.
- **Logged out?** **Yes.** Guards at lines 499-504 are: client exists and `product.id` set;
  skip if `currentUserId === product.seller?.id` (don't count your own views); skip if
  `sessionStorage["viewed_<id>"]` is set. **None of them require a session** — the
  own-seller check is a no-op when `currentUserId` is null.
- **Survives RLS.** The function is declared `SECURITY DEFINER`
  (`20260808143802_remote_schema.sql:178`), so its `UPDATE` runs as the function owner and
  is not subject to the caller's policies. `EXECUTE` was deliberately left granted to
  `PUBLIC` — see the comment at `20260809141828_performance_and_grants.sql:181-184`.
- **No `products` policy needed for this call.** Worth an explicit note in the migration so
  nobody "fixes" it later.

**Policy needed:** a `SELECT` policy on `products` only if `products` is added to the
Realtime publication (§3.1). The backend serves all product *reads* over REST, so the feed
itself is unaffected.

---

## 4. `public.visitor_metrics` — 1 RPC write + 1 read, both fully public

Both live in `frontend/src/components/footer/footer.jsx`, in one unguarded
`useEffect(…, [])` at line 52. `Footer` is rendered by `App.jsx:117` on **every route except
`/dashboard`**, including `/` and `/auth`. **There is no auth check of any kind** — the
branch is purely `sessionStorage.getItem("hasVisited")`.

### 4.1 `footer.jsx:56` — `rpc("increment_page_view")` — first visit in a tab session

```js
const { data, error } = await supabase.rpc("increment_page_view");
```

- **Function:** `public.increment_page_view()`. **Write + read** —
  `UPDATE visitor_metrics SET view_count = view_count + 1 WHERE id = 1 RETURNING view_count`.
- **Logged out?** **Yes**, and this is the normal case — it's the landing-page visitor
  counter.
- ⚠️ **This one breaks.** Unlike `increment_product_views`, `increment_page_view()` is
  **not** `SECURITY DEFINER` (`20260808143802_remote_schema.sql:134-148`). It runs as the
  caller, so its `UPDATE` is subject to the caller's policies. `EXECUTE` being granted to
  `anon`/`PUBLIC` is not enough. It needs **both** an `UPDATE` policy and a `SELECT` policy
  for `anon` on `visitor_metrics` (the `RETURNING` clause is a select), or it must be
  changed to `SECURITY DEFINER`.

### 4.2 `footer.jsx:63-67` — subsequent visits in the same tab session

```js
const { data, error } = await supabase
  .from("visitor_metrics")
  .select("view_count")
  .eq("id", 1)
  .single();
```

- **Columns:** `view_count`. **Filter:** `id = 1`. **Read.**
- **Logged out?** **Yes.**

**Policy needed:** `SELECT` on `visitor_metrics` for `anon` (single global counter row —
`USING (true)` is fine, there is nothing per-user in this table), plus either an `UPDATE`
policy for `anon` or making `increment_page_view()` `SECURITY DEFINER`. The latter is
tighter: it keeps direct `UPDATE`s closed while letting the counter work.

---

## 5. Storage buckets — `avatars`

Storage RLS is `storage.objects`, not a `public` table, so it is **not** part of the
13-table rollout. Listed because the same anon key is doing the work and the `avatars`
bucket has **no policies anywhere in `supabase/migrations/`** — only `products` and `posts`
are covered by `20260808144138_storage_policies.sql`. Whatever governs `avatars` in
production was created outside the repo and is invisible to both developers.

| # | Location | Call | Path | R/W | Logged out? |
|---|---|---|---|---|---|
| 5.1 | `frontend/src/pages/onboarding/onboarding.jsx:211-213` | `storage.from("avatars").upload(filePath, file)` | `profiles/<ts>-<rand>.<ext>` | **Write** | **Yes, effectively** — `/onboarding` is unguarded in `App.jsx:106` and the page has no session check; and per §0.1 the upload carries **no auth token** regardless, so it hits the bucket as `anon` |
| 5.2 | `frontend/src/pages/onboarding/onboarding.jsx:218-220` | `storage.from("avatars").getPublicUrl(filePath)` | same | neither | n/a — pure client-side string building, no network call, no RLS |
| 5.3 | `mobile/app/(auth)/onboarding.tsx:131-133` | `storage.from('avatars').upload(path, arrayBuffer, { contentType })` | `profiles/<ts>-<rand>.<ext>` | **Write** | **No** — `AuthGate` (`mobile/app/_layout.tsx:46`) only routes into `(auth)/onboarding` when a session exists; uploads as `authenticated` |
| 5.4 | `mobile/app/(auth)/onboarding.tsx:136` | `storage.from('avatars').getPublicUrl(path)` | same | neither | n/a — no network call |

The web upload (5.1) being anonymous is the same root cause as §0.1: an unauthenticated
`INSERT` into a bucket. If `avatars` gets a policy modelled on the `products` bucket
(`TO authenticated`), **web onboarding avatar upload stops working** until §0.1 is fixed.
Mobile is unaffected.

---

## 6. Non-RLS channels (presence + broadcast) — listed for completeness

These carry no database rows, so Realtime never evaluates a policy for them. They will keep
working after RLS is enabled. Do **not** write policies for them.

| # | Location | Channel | Type | Logged out? |
|---|---|---|---|---|
| 6.1 | `frontend/src/components/navbar/navbar.jsx:201-215` | `online-users` (presence key = `userId`) | presence sync + `track()` | **No** — same `isAuthenticated && userId` guard, line 178 |
| 6.2 | `mobile/src/contexts/RealtimeContext.tsx:222-235` | `online-users` (presence key = `userId`) | presence sync + `track()` | **No** — `if (!userId) return`, line 216 |
| 6.3 | `mobile/app/chat/[contactId].tsx:143-151` | `typing:<sortedIds>:<productId>` | broadcast, event `typing` | **No** — `if (!myId \|\| !contactId \|\| !productId \|\| isSelfChat) return`, line 140 |

`frontend/src/pages/messages/Messages.jsx:328-338` consumes presence through a
`window` custom event published by the navbar — no Supabase call of its own.

---

## 7. Summary table

| Table | Direct client access | Where | Logged out? | Policy required |
|---|---|---|---|---|
| `users` | read × 2 | web Marketplace, ProductDetail | no | `SELECT` own row |
| `messages` | read × 1, realtime × 3 | web navbar ×2, web Messages, mobile RealtimeContext | **web Messages: yes** | `SELECT` where caller is sender or receiver |
| `products` | realtime × 1, rpc write × 1 | web ProductCard | **yes, both** | `SELECT` only if added to the realtime publication; the RPC is `SECURITY DEFINER` and needs none |
| `visitor_metrics` | rpc write × 1, read × 1 | web footer | **yes, both** | `SELECT` for `anon`; plus `UPDATE` for `anon` **or** make `increment_page_view()` `SECURITY DEFINER` |

---

## 8. Tables reached ONLY through `backend/` — safe to lock down completely

The backend uses the **service-role key** (`backend/CLAUDE.md`, security checklist), which
bypasses RLS entirely. For these tables, enabling RLS with **no policies at all** changes
nothing about how the app behaves today — the controller stays the only gate, exactly as it
is now.

Verified by grepping `backend/src/` for `.from('<table>')` and cross-checking each against
the client inventory above.

| Table | Backend usage | Client usage |
|---|---|---|
| `universities` | 5 call sites (`university`, `auth`, `products` modules) | none — web/mobile read `GET /api/universities` |
| `courses` | 1 call site (`academic` module) | none — `GET /api/academic/courses` |
| `specializations` | 1 call site (`academic` module) | none — `GET /api/academic/specializations` |
| `product_likes` | 6 call sites (`products` module) | none — `POST /api/products/:id/like` |
| `product_saves` | 6 call sites (`products` module) | none — `POST /api/products/:id/save` |
| `purchases` | 3 call sites (`products`, `user` modules) | none |
| `comments` | 1 call site + `toggle_comment_vote` RPC | none — `POST /api/products/:id/comments` |
| `comment_votes` | 1 call site (`products` module) | none — `POST /api/products/comments/:id/vote` |

**8 of the 13 tables.** Locking these with RLS enabled and zero policies is the cheap,
zero-risk half of the rollout — do it first and separately from the four in §7.

### Touched by neither backend nor client

| Table | Note |
|---|---|
| `posts` | The table exists (`schema.md:41`), but `backend/src/modules/posts/` is a Phase 6 stub — `posts.controller.js:7` says "Phase 6 fills this in" — and there is no client query. `frontend/CLAUDE.md` §13 already flags `/feed` and `/hot` as placeholder routes. Enable RLS with no policies now; write policies alongside the module. |

**Count check:** 4 client-touched (§7) + 8 backend-only + 1 untouched = **13**. ✅

---

## 9. Recommended order

1. **Enable RLS, no policies, on the 8 backend-only tables + `posts`** (9 tables). Nothing
   observable changes; the service-role backend is unaffected.
2. **Fix `frontend/src/contexts/AuthContext.jsx` to call `supabase.auth.setSession()`**
   (§0.1). This is Neeraj's file — needs a `docs/CHANGELOG.md` handoff. Until it lands,
   `auth.uid()`-based policies cannot be used for web, and the web avatar upload is anonymous.
3. **`visitor_metrics`** — independent of step 2 (it is anon by design). Make
   `increment_page_view()` `SECURITY DEFINER` and add a public `SELECT` policy.
4. **`users` and `messages`** — only after step 2 is deployed and verified, or the navbar
   unread badge and the whole web chat go quiet with no error in the console.
5. **`products`** — a `SELECT` policy is only needed if/when `products` joins the
   `supabase_realtime` publication (§0.4). Nothing to do today.
6. **Separately: `avatars` bucket policies** (§5) — currently unmanaged, exists only in the
   production dashboard, and blocked on step 2 for web.
