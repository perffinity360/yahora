-- ============================================================================
-- Migration 005 — usernames, password plumbing, and the signup trigger
--
-- Four problems from plan §1.1, each mapping to one piece of schema below:
--   1. Case      -> handles are LOWERCASE ONLY, enforced by the CHECK in §3.
--                   Rahul and rahul cannot both exist because Rahul cannot
--                   exist at all. Uppercase input is folded, never rejected:
--                   the UI lowercases as the student types, the backend
--                   lowercases before writing, and the CHECK is the backstop
--                   if either forgets.
--   2. The race  -> the UNIQUE index is the arbiter. Two students who both
--                   pass the availability check in the same instant are
--                   separated by 23505, which the backend catches.
--   3. Routes    -> reserved_usernames, enforced by a trigger, so /settings
--                   can never become a student's handle.
--   4. Squatting -> username_history keeps a released handle locked 30 days.
--
-- Plus two from the password work (runbook §0.6):
--   5. Supabase cannot sign in by username -> get_login_email() maps one to
--      the email, and is callable only by the service role.
--   6. Brute force -> auth_attempts + a 15-minute lockout, enforced in the
--      backend against the rows this file stores.
--
-- NOT IN THIS FILE, deliberately: the users_username_required_when_complete
-- constraint. It belongs in migration 006, AFTER the backfill. See §3.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Extension.
--
-- pg_trgm powers fuzzy search — "rahl" should still find "rahul" — and backs
-- the two GIN indexes in §4.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;


-- ---------------------------------------------------------------------------
-- 2. Columns on users.
--
-- has_password is a CACHE ONLY, so the backend can answer "does this account
-- have a password?" without a round trip into the auth schema. The real hash
-- lives in auth.users.encrypted_password and belongs to Supabase Auth.
-- NEVER add a password or password_hash column to this table.
-- ---------------------------------------------------------------------------

alter table public.users
  add column username            text,
  add column username_changed_at timestamptz,
  add column has_password        boolean not null default false;


-- ---------------------------------------------------------------------------
-- 3. Format rules, enforced by the database itself.
--
-- One regex carries all four rules:
--   ^[a-z]           must START WITH A LETTER. Not a digit, not a separator.
--                    This keeps handles distinguishable from ids and keeps
--                    /rahul from ever colliding with a numeric route.
--   [a-z0-9._-]*$    the only characters allowed anywhere after it. Two things
--                    fall out of the charset rather than needing their own
--                    rule: NO UPPERCASE (A-Z is simply not in it) and NO
--                    SPACES (nor tabs, nor newlines).
--   length 3..25
--
-- `username = lower(username)` is redundant next to that charset — [a-z]
-- already excludes every capital. It is kept anyway because "no capital
-- letters, ever" is a product decision someone will one day try to relax by
-- editing the charset, and this line makes the intent impossible to miss.
--
-- Uppercase is NORMALISED, NOT REJECTED. A student with caps lock on types
-- RAHUL and gets rahul, silently — no error, nothing to correct. That folding
-- happens in the UI as they type and again in the backend before the write;
-- this constraint is the backstop for when one of those is wrong, not the
-- thing the student ever meets.
--
-- Trailing separators (rahul_) and repeated separators (rahul__sharma) are
-- both ALLOWED, matching Instagram. Note what that costs: rahul_ and rahul are
-- different handles, as are rahul.sharma and rahul..sharma. Those are
-- impersonation vectors on a campus app and the reserved list does not cover
-- them — the Phase 8 moderation queue is what has to. Lowercase-only at least
-- removes the worst of that family (RahuI with a capital i, alongside Rahul
-- with a lowercase L, is now unrepresentable).
--
-- The "username required when profile is complete" constraint is NOT here. It
-- goes in migration 006, after the backfill. Adding it now would PASS locally,
-- where the table is empty, and FAIL on production, where existing completed
-- users still have username = NULL. That divergence is exactly the class of
-- bug this ordering exists to avoid.
-- ---------------------------------------------------------------------------

alter table public.users add constraint users_username_valid check (
  username is null or (
        username = lower(username)
    and length(username) between 3 and 25
    and username ~ '^[a-z][a-z0-9._-]*$'
  )
);


-- ---------------------------------------------------------------------------
-- 4. Indexes.
--
-- Plain column indexes, not lower(username) functional ones. §3 guarantees the
-- stored value is already lowercase, so lower(username) would index an
-- identical string — case-insensitive uniqueness comes free from the CHECK,
-- and a functional index would be dead weight on every write.
--
-- The consequence for callers: `where username = $1` is correct AS LONG AS the
-- backend lowercases $1 first. It always should — the same fold it does before
-- writing — and CC-4 already requires it.
--
-- The unique index does two jobs at once: it stops duplicates, and it is the
-- index Postgres uses for that exact lookup. NULLs are allowed to repeat,
-- which is what makes the 006 backfill possible.
--
-- users_username_prefix_idx has to be SEPARATE from the unique index, and this
-- is the part that looks redundant but is not. Postgres sorts text by the
-- database collation, which handles questions like "does á come before b".
-- `like 'rah%'` needs plain byte-order sorting to use an index at all, and
-- text_pattern_ops is what builds that second ordering. Without this index,
-- every prefix search in search_users() degrades to a full table scan.
-- ---------------------------------------------------------------------------

create unique index users_username_key on public.users (username);

create index users_username_prefix_idx on public.users (username text_pattern_ops);

create index users_username_trgm_idx  on public.users using gin (username  gin_trgm_ops);
create index users_full_name_trgm_idx on public.users using gin (full_name gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- 5. Reserved usernames.
--
-- Usernames are root-level URLs (/rahul), so every current and planned
-- top-level route is also a handle someone could claim. This is a TABLE rather
-- than a hardcoded list in JavaScript for two reasons: adding /events six
-- months from now is one INSERT instead of a code change and a redeploy, and a
-- list living in the backend would not stop any other path from writing the
-- row.
--
-- THE LIST IS DELIBERATELY LARGE (~717 entries, nine categories). Reserving a
-- word costs one row; failing to reserve one costs the route forever, because
-- taking a handle back from a real student is not something we are willing to
-- do. So this covers routes we have, routes we might plausibly build, the
-- brand and its separator variants, infrastructure and technical words,
-- legal/safety pages, commerce vocabulary, and the four campuses by every
-- spelling.
--
-- Two limits worth knowing:
--
--   1. Matching is EXACT. Reserving `yahora-support` does not reserve
--      `yahora.support` or `yahora_support`, because `.`, `_` and `-` are all
--      legal characters. Every brand variant here is therefore spelled out by
--      hand, which does not scale. The scalable fix is to compare a normalised
--      form (separators stripped) instead — see the note in §7.
--
--   2. Entries shorter than 3 characters can never match a valid username
--      (§3 sets the floor at 3), so they would be inert. The old `u` row was
--      exactly that and has been dropped; the /u/ route is safe regardless.
--
-- One known cost: `dev` is reserved as a technical word, and it is also a
-- common Indian given name. A student called Dev can still take dev.sharma or
-- devkumar — only the bare handle is blocked. Remove that one row if you would
-- rather have the name than the route.
-- ---------------------------------------------------------------------------

create table public.reserved_usernames (
  username text primary key,
  reason   text not null default 'system'
);

insert into public.reserved_usernames (username, reason) values
  -- Current and planned application routes — the reason this table exists
  ('marketplace','route'), ('market','route'), ('markets','route'),
  ('product','route'), ('products','route'), ('listing','route'),
  ('listings','route'), ('sell','route'), ('selling','route'),
  ('sold','route'), ('buy','route'), ('buying','route'),
  ('bought','route'), ('browse','route'), ('search','route'),
  ('searches','route'), ('explore','route'), ('discover','route'),
  ('discovery','route'), ('messages','route'), ('message','route'),
  ('messaging','route'), ('chat','route'), ('chats','route'),
  ('inbox','route'), ('outbox','route'), ('sent','route'),
  ('dms','route'), ('dashboard','route'), ('home','route'),
  ('homepage','route'), ('feed','route'), ('feeds','route'),
  ('timeline','route'), ('hot','route'), ('hotat','route'),
  ('hot-at','route'), ('trending','route'), ('popular','route'),
  ('top','route'), ('best','route'), ('latest','route'),
  ('new','route'), ('news','route'), ('profile','route'),
  ('profiles','route'), ('user','route'), ('users','route'),
  ('account','route'), ('accounts','route'), ('settings','route'),
  ('setting','route'), ('preferences','route'), ('onboarding','route'),
  ('onboard','route'), ('welcome','route'), ('start','route'),
  ('getstarted','route'), ('get-started','route'), ('auth','route'),
  ('login','route'), ('log-in','route'), ('logout','route'),
  ('log-out','route'), ('signin','route'), ('sign-in','route'),
  ('signout','route'), ('sign-out','route'), ('signup','route'),
  ('sign-up','route'), ('register','route'), ('registration','route'),
  ('notifications','route'), ('notification','route'), ('alerts','route'),
  ('alert','route'), ('saved','route'), ('saves','route'),
  ('wishlist','route'), ('wishlists','route'), ('favorites','route'),
  ('favourites','route'), ('bookmarks','route'), ('bookmark','route'),
  ('following','route'), ('followers','route'), ('follow','route'),
  ('friends','route'), ('friend','route'), ('post','route'),
  ('posts','route'), ('comment','route'), ('comments','route'),
  ('reply','route'), ('replies','route'), ('thread','route'),
  ('threads','route'), ('community','route'), ('communities','route'),
  ('club','route'), ('clubs','route'), ('group','route'),
  ('groups','route'), ('channel','route'), ('channels','route'),
  ('forum','route'), ('forums','route'), ('sell-item','route'),
  ('sellitem','route'), ('edit-profile','route'), ('editprofile','route'),
  ('public-profile','route'), ('publicprofile','route'),

  -- Yahora identity, plus the separator variants a squatter would reach for
  ('yahora','brand'), ('yahoraapp','brand'), ('yahora-app','brand'),
  ('yahora.app','brand'), ('yahoraofficial','brand'), ('yahora-official','brand'),
  ('official-yahora','brand'), ('officialyahora','brand'), ('yahorateam','brand'),
  ('yahora-team','brand'), ('team-yahora','brand'), ('teamyahora','brand'),
  ('yahorasupport','brand'), ('yahora-support','brand'), ('yahorahelp','brand'),
  ('yahora-help','brand'), ('yahoraadmin','brand'), ('yahora-admin','brand'),
  ('yahorahq','brand'), ('yahora-hq','brand'), ('yahoracare','brand'),
  ('yahora-care','brand'), ('yahoraindia','brand'), ('yahora-india','brand'),
  ('myyahora','brand'), ('my-yahora','brand'), ('getyahora','brand'),
  ('get-yahora','brand'), ('joinyahora','brand'), ('join-yahora','brand'),
  ('official','brand'), ('officials','brand'), ('staff','brand'),
  ('employee','brand'), ('employees','brand'), ('team','brand'),
  ('teams','brand'), ('moderator','brand'), ('moderators','brand'),
  ('mod','brand'), ('mods','brand'), ('developer','brand'),
  ('developers','brand'), ('dev','brand'), ('devs','brand'),
  ('owner','brand'), ('owners','brand'), ('founder','brand'),
  ('founders','brand'), ('ceo','brand'), ('cto','brand'),
  ('coo','brand'), ('admin-team','brand'), ('adminteam','brand'),
  ('company','brand'), ('brand','brand'), ('corporate','brand'),
  ('headquarters','brand'),

  -- Infrastructure, technical and reserved words that break tooling
  ('admin','system'), ('administrator','system'), ('admins','system'),
  ('api','system'), ('apis','system'), ('authentication','system'),
  ('authorize','system'), ('oauth','system'), ('sso','system'),
  ('root','system'), ('superuser','system'), ('sudo','system'),
  ('system','system'), ('systems','system'), ('internal','system'),
  ('external','system'), ('session','system'), ('sessions','system'),
  ('token','system'), ('tokens','system'), ('password','system'),
  ('passwords','system'), ('reset','system'), ('forgot','system'),
  ('forgot-password','system'), ('reset-password','system'), ('confirm','system'),
  ('confirmation','system'), ('activate','system'), ('activation','system'),
  ('verify','system'), ('verification','system'), ('verified','system'),
  ('otp','system'), ('code','system'), ('codes','system'),
  ('callback','system'), ('redirect','system'), ('connect','system'),
  ('disconnect','system'), ('link','system'), ('unlink','system'),
  ('www','system'), ('web','system'), ('app','system'),
  ('apps','system'), ('mobile','system'), ('ios','system'),
  ('android','system'), ('desktop','system'), ('graphql','system'),
  ('rest','system'), ('rpc','system'), ('webhook','system'),
  ('webhooks','system'), ('cdn','system'), ('static','system'),
  ('assets','system'), ('asset','system'), ('public','system'),
  ('private','system'), ('images','system'), ('image','system'),
  ('img','system'), ('icons','system'), ('icon','system'),
  ('fonts','system'), ('font','system'), ('favicon','system'),
  ('robots','system'), ('sitemap','system'), ('manifest','system'),
  ('well-known','system'), ('service-worker','system'), ('health','system'),
  ('healthz','system'), ('ping','system'), ('status','system'),
  ('uptime','system'), ('monitor','system'), ('monitoring','system'),
  ('log','system'), ('logs','system'), ('debug','system'),
  ('trace','system'), ('test','system'), ('tests','system'),
  ('testing','system'), ('staging','system'), ('stage','system'),
  ('prod','system'), ('production','system'), ('development','system'),
  ('local','system'), ('localhost','system'), ('sandbox','system'),
  ('demo','system'), ('beta','system'), ('alpha','system'),
  ('preview','system'), ('canary','system'), ('legacy','system'),
  ('old','system'), ('tmp','system'), ('temp','system'),
  ('cache','system'), ('queue','system'), ('worker','system'),
  ('workers','system'), ('cron','system'), ('batch','system'),
  ('backup','system'), ('backups','system'), ('restore','system'),
  ('migrate','system'), ('migration','system'), ('migrations','system'),
  ('seed','system'), ('seeds','system'), ('database','system'),
  ('sql','system'), ('storage','system'), ('bucket','system'),
  ('buckets','system'), ('mail','system'), ('email','system'),
  ('emails','system'), ('smtp','system'), ('imap','system'),
  ('pop3','system'), ('ftp','system'), ('ssh','system'),
  ('dns','system'), ('noreply','system'), ('no-reply','system'),
  ('donotreply','system'), ('do-not-reply','system'), ('postmaster','system'),
  ('webmaster','system'), ('hostmaster','system'), ('info','system'),
  ('sales','system'), ('marketing','system'), ('newsletter','system'),
  ('subscribe','system'), ('unsubscribe','system'), ('null','system'),
  ('undefined','system'), ('nil','system'), ('none','system'),
  ('void','system'), ('empty','system'), ('blank','system'),
  ('unknown','system'), ('anonymous','system'), ('anon','system'),
  ('guest','system'), ('nobody','system'), ('everyone','system'),
  ('everybody','system'), ('all','system'), ('any','system'),
  ('other','system'), ('others','system'), ('default','system'),
  ('example','system'), ('examples','system'), ('sample','system'),
  ('samples','system'), ('placeholder','system'), ('foo','system'),
  ('bar','system'), ('baz','system'), ('lorem','system'),
  ('ipsum','system'),

  -- Legal, policy and static pages
  ('about','page'), ('aboutus','page'), ('about-us','page'),
  ('contact','page'), ('contactus','page'), ('contact-us','page'),
  ('support','page'), ('help','page'), ('helpdesk','page'),
  ('helpcenter','page'), ('help-center','page'), ('faq','page'),
  ('faqs','page'), ('privacy','page'), ('privacypolicy','page'),
  ('privacy-policy','page'), ('terms','page'), ('termsofservice','page'),
  ('terms-of-service','page'), ('tos','page'), ('terms-and-conditions','page'),
  ('legal','page'), ('license','page'), ('licenses','page'),
  ('copyright','page'), ('dmca','page'), ('imprint','page'),
  ('disclaimer','page'), ('cookies','page'), ('cookie-policy','page'),
  ('accessibility','page'), ('guidelines','page'), ('community-guidelines','page'),
  ('communityguidelines','page'), ('rules','page'), ('policy','page'),
  ('policies','page'), ('compliance','page'), ('deletion','page'),
  ('delete-account','page'), ('deleteaccount','page'), ('gdpr','page'),
  ('dpo','page'), ('careers','page'), ('career','page'),
  ('press','page'), ('blog','page'), ('blogs','page'),
  ('article','page'), ('articles','page'), ('pricing','page'),
  ('plans','page'), ('plan','page'), ('premium','page'),
  ('pro','page'), ('plus','page'), ('upgrade','page'),
  ('free','page'), ('trial','page'), ('download','page'),
  ('downloads','page'),

  -- Trust, safety and moderation — impersonating these is the real risk
  ('safety','safety'), ('childsafety','safety'), ('child-safety','safety'),
  ('security','safety'), ('secure','safety'), ('report','safety'),
  ('reports','safety'), ('reporting','safety'), ('moderation','safety'),
  ('moderate','safety'), ('abuse','safety'), ('spam','safety'),
  ('scam','safety'), ('scams','safety'), ('fraud','safety'),
  ('phishing','safety'), ('feedback','safety'), ('suggestions','safety'),
  ('suggestion','safety'), ('complaint','safety'), ('complaints','safety'),
  ('grievance','safety'), ('grievanceofficer','safety'), ('grievance-officer','safety'),
  ('trust','safety'), ('verify-account','safety'), ('verifiedaccount','safety'),
  ('block','safety'), ('blocked','safety'), ('mute','safety'),
  ('muted','safety'), ('ban','safety'), ('banned','safety'),
  ('appeal','safety'), ('appeals','safety'),

  -- Payments and transactions — reserved before we ever build them
  ('cart','commerce'), ('carts','commerce'), ('checkout','commerce'),
  ('payment','commerce'), ('payments','commerce'), ('pay','commerce'),
  ('billing','commerce'), ('invoice','commerce'), ('invoices','commerce'),
  ('purchase','commerce'), ('purchases','commerce'), ('order','commerce'),
  ('orders','commerce'), ('refund','commerce'), ('refunds','commerce'),
  ('return','commerce'), ('returns','commerce'), ('shipping','commerce'),
  ('delivery','commerce'), ('tax','commerce'), ('taxes','commerce'),
  ('gst','commerce'), ('price','commerce'), ('prices','commerce'),
  ('deal','commerce'), ('deals','commerce'), ('offer','commerce'),
  ('offers','commerce'), ('discount','commerce'), ('discounts','commerce'),
  ('coupon','commerce'), ('coupons','commerce'), ('promo','commerce'),
  ('promos','commerce'), ('promocode','commerce'), ('seller','commerce'),
  ('sellers','commerce'), ('buyer','commerce'), ('buyers','commerce'),
  ('transaction','commerce'), ('transactions','commerce'), ('escrow','commerce'),
  ('wallet','commerce'), ('wallets','commerce'), ('credits','commerce'),
  ('coins','commerce'), ('points','commerce'), ('rewards','commerce'),
  ('reward','commerce'), ('subscription','commerce'), ('subscriptions','commerce'),
  ('rating','commerce'), ('ratings','commerce'), ('review','commerce'),
  ('reviews','commerce'),

  -- Social graph and feed vocabulary
  ('story','social'), ('stories','social'), ('statuses','social'),
  ('share','social'), ('shares','social'), ('like','social'),
  ('likes','social'), ('upvote','social'), ('upvotes','social'),
  ('downvote','social'), ('downvotes','social'), ('vote','social'),
  ('votes','social'), ('react','social'), ('reaction','social'),
  ('reactions','social'), ('swipe','social'), ('swipes','social'),
  ('match','social'), ('matches','social'), ('request','social'),
  ('requests','social'), ('invite','social'), ('invites','social'),
  ('invitation','social'), ('invitations','social'), ('unfollow','social'),
  ('unblock','social'), ('people','social'), ('person','social'),
  ('contacts','social'), ('circle','social'), ('circles','social'),
  ('network','social'), ('networks','social'), ('board','social'),
  ('boards','social'), ('mention','social'), ('mentions','social'),
  ('tag','social'), ('tags','social'), ('hashtag','social'),
  ('hashtags','social'),

  -- Features we may plausibly ship — the whole point of this exercise
  ('event','future'), ('events','future'), ('calendar','future'),
  ('schedule','future'), ('resource','future'), ('resources','future'),
  ('gallery','future'), ('photos','future'), ('photo','future'),
  ('videos','future'), ('video','future'), ('album','future'),
  ('albums','future'), ('media','future'), ('uploads','future'),
  ('upload','future'), ('file','future'), ('files','future'),
  ('attachment','future'), ('attachments','future'), ('leaderboard','future'),
  ('ranking','future'), ('rankings','future'), ('activity','future'),
  ('activities','future'), ('heatmap','future'), ('analytics','future'),
  ('metrics','future'), ('stats','future'), ('statistics','future'),
  ('insights','future'), ('avatar','future'), ('avatars','future'),
  ('document','future'), ('documents','future'), ('docs','future'),
  ('printing','future'), ('printouts','future'), ('print','future'),
  ('material','future'), ('materials','future'), ('digitalmaterials','future'),
  ('digital-materials','future'), ('notes','future'), ('note','future'),
  ('books','future'), ('book','future'), ('library','future'),
  ('study','future'), ('courses','future'), ('course','future'),
  ('class','future'), ('classes','future'), ('exam','future'),
  ('exams','future'), ('results','future'), ('result','future'),
  ('syllabus','future'), ('assignment','future'), ('assignments','future'),
  ('project','future'), ('projects','future'), ('lab','future'),
  ('labs','future'), ('room','future'), ('rooms','future'),
  ('rental','future'), ('rentals','future'), ('roomrental','future'),
  ('room-rental','future'), ('rent','future'), ('housing','future'),
  ('hostel','future'), ('hostels','future'), ('flat','future'),
  ('flats','future'), ('roommate','future'), ('roommates','future'),
  ('sponsor','future'), ('sponsors','future'), ('sponsorship','future'),
  ('sponsorships','future'), ('ads','future'), ('advertise','future'),
  ('advertising','future'), ('promote','future'), ('promotion','future'),
  ('job','future'), ('jobs','future'), ('internship','future'),
  ('internships','future'), ('intern','future'), ('interns','future'),
  ('hiring','future'), ('recruit','future'), ('recruitment','future'),
  ('placement','future'), ('placements','future'), ('alumni','future'),
  ('mentor','future'), ('mentors','future'), ('mentorship','future'),
  ('online','future'), ('offline','future'), ('live','future'),
  ('stream','future'), ('streaming','future'), ('map','future'),
  ('maps','future'), ('location','future'), ('locations','future'),
  ('nearby','future'), ('lost','future'), ('found','future'),
  ('lostandfound','future'), ('lost-and-found','future'), ('ride','future'),
  ('rides','future'), ('carpool','future'), ('food','future'),
  ('mess','future'), ('canteen','future'), ('tuition','future'),
  ('tutor','future'), ('tutors','future'), ('coaching','future'),
  ('quiz','future'), ('quizzes','future'), ('poll','future'),
  ('polls','future'), ('survey','future'), ('surveys','future'),
  ('ticket','future'), ('tickets','future'), ('booking','future'),
  ('bookings','future'), ('reservation','future'), ('reservations','future'),

  -- Institutions and campus names — squatting these enables impersonation
  ('university','campus'), ('universities','campus'), ('uni','campus'),
  ('college','campus'), ('colleges','campus'), ('campus','campus'),
  ('campuses','campus'), ('institute','campus'), ('institutes','campus'),
  ('institution','campus'), ('school','campus'), ('schools','campus'),
  ('department','campus'), ('departments','campus'), ('faculty','campus'),
  ('branch','campus'), ('iiit','campus'), ('iiitdm','campus'),
  ('iiitk','campus'), ('iiitdmkurnool','campus'), ('iiitdm-kurnool','campus'),
  ('iiit-kurnool','campus'), ('iiitkurnool','campus'), ('kurnool','campus'),
  ('niet','campus'), ('nietgreaternoida','campus'), ('niet-greater-noida','campus'),
  ('greaternoida','campus'), ('greater-noida','campus'), ('noida','campus'),
  ('nit','campus'), ('nitdelhi','campus'), ('nit-delhi','campus'),
  ('delhi','campus'), ('iit','campus'), ('iittp','campus'),
  ('iittirupati','campus'), ('iit-tirupati','campus'), ('tirupati','campus');

-- Enforced by a trigger, not a CHECK constraint. A CHECK in Postgres can only
-- look at the row being written — it cannot query another table — and checking
-- against reserved_usernames requires a SELECT.
--
-- ERRCODE 23514 is check_violation: the backend already treats that class as a
-- client error, so a reserved handle surfaces as a clean 400 rather than a 500.
--
-- The comparison is lower()ed even though §3 forbids capitals. BEFORE triggers
-- run before CHECK constraints, so at this moment new.username may still be
-- 'Admin' from a caller that skipped its fold. Without lower() that slips past
-- the reserved list and is caught one step later by users_username_valid —
-- same rejection, but a confusing error about format instead of the accurate
-- USERNAME_RESERVED the backend maps to a specific message.

create or replace function public.check_username_not_reserved()
  returns trigger
  language plpgsql
as $function$
begin
  if new.username is not null
     and exists (select 1 from public.reserved_usernames where username = lower(new.username))
  then
    raise exception 'USERNAME_RESERVED' using errcode = '23514';
  end if;

  return new;
end;
$function$;

create trigger trg_username_not_reserved
  before insert or update of username on public.users
  for each row execute function public.check_username_not_reserved();


-- ---------------------------------------------------------------------------
-- 6. Username history — anti-squatting and old-link redirects.
--
-- Rahul renames himself to rahul.sharma. Without this table a bot can register
-- `rahul` seconds later and impersonate him to everyone who still has the old
-- link. reserved_until locks the released handle for 30 days, and the same row
-- is what lets /rahul redirect to /rahul.sharma instead of 404ing — which is
-- what keeps a link posted in a WhatsApp group alive.
-- ---------------------------------------------------------------------------

create table public.username_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  username       text not null,
  released_at    timestamptz not null default now(),
  reserved_until timestamptz not null default (now() + interval '30 days')
);

create index username_history_lookup_idx on public.username_history (username, reserved_until desc);
create index username_history_user_idx   on public.username_history (user_id);

-- Recording the old handle is the database's job, not the backend's. Any path
-- that changes a username — the user module today, an admin tool later —
-- records history and stamps username_changed_at without having to remember to.

create or replace function public.record_username_change()
  returns trigger
  language plpgsql
as $function$
begin
  if old.username is not null and new.username is distinct from old.username then
    insert into public.username_history (user_id, username)
    values (old.id, old.username);

    new.username_changed_at := now();
  end if;

  return new;
end;
$function$;

create trigger trg_record_username_change
  before update of username on public.users
  for each row execute function public.record_username_change();


-- ---------------------------------------------------------------------------
-- 7. Username functions.
--
-- A note on who may execute these. Migration 003 revoked default privileges on
-- routines from anon and authenticated, but Postgres grants EXECUTE to PUBLIC
-- by default and anon inherits that — so everything here is reachable with the
-- publishable key unless explicitly revoked (§8 does exactly that for the one
-- function where it matters). That is acceptable for the four below:
-- is_username_available returns a single boolean, and the other three are
-- SECURITY INVOKER, so for a non-service-role caller they read through RLS and
-- see nothing. Only the Express backend, on the service-role key, gets real
-- answers out of them.
-- ---------------------------------------------------------------------------

-- One round trip answers all four questions the onboarding UI needs: is the
-- format legal, is it a route, does someone already have it, and is it inside
-- the 30-day cooling-off window. The backend calls this and does NOT
-- re-implement any of the four in JavaScript — if the two ever disagree, the
-- result is a bug nobody can find.
--
-- SECURITY DEFINER because availability has to be checkable before the student
-- is authenticated, so the caller may have no permission to read users. It is
-- deliberately NOT revoked: it returns one boolean and leaks nothing the public
-- profile URL does not already.
--
-- p_user_id is how a student's own current handle reads as available to them.

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
begin
  -- The fold happens FIRST, so this answers "is the handle you would actually
  -- get available?" rather than "did you type it in the right case?". A caps
  -- lock user asking about RAHUL is asking about rahul, and gets a straight
  -- answer instead of a format error they cannot act on. The remaining checks
  -- mirror the §3 CHECK exactly — if the two ever drift, this function says
  -- yes and the insert says no, and the student sees a 500 on a handle we
  -- just told them was free.
  if u is null
     or length(u) not between 3 and 25
     or u !~ '^[a-z][a-z0-9._-]*$'
  then
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


-- "Rahul  Sharma!" -> "rahul.sharma". Used by the 006 backfill and as the
-- fallback inside suggest_usernames.
--
-- Generated handles are always lowercase even though mixed case is now legal:
-- these are machine-assigned, and a student who wants RahulSharma can set it
-- at onboarding. What matters more is the leading-letter strip below — a name
-- like "2020 Batch Rahul" would otherwise generate 2020.batch.rahul, which the
-- §3 CHECK rejects, and migration 006's backfill would abort partway through
-- production. The generator must only ever emit handles the constraint accepts.
--
-- The suffix is RANDOM, never sequential. rahul.0001 / rahul.0002 would tell
-- anyone who looked roughly how many users we have, and would make every new
-- "rahul" scan the same range. rahul.7402 gives away nothing.

create or replace function public.generate_username(p_name text)
  returns text
  language plpgsql
as $function$
declare
  base      text;
  candidate text;
  suffix    text;
  attempts  int := 0;
begin
  base := lower(coalesce(p_name, ''));
  base := regexp_replace(base, '[^a-z0-9]+', '.', 'g');
  base := regexp_replace(base, '\.{2,}', '.', 'g');
  base := trim(both '.' from base);
  base := regexp_replace(base, '^[^a-z]+', '');   -- §3: must start with a letter
  base := left(base, 19);
  base := trim(both '.' from base);

  if base is null or length(base) < 3 then
    base := 'student';
  end if;

  candidate := base;

  while not public.is_username_available(candidate) loop
    attempts := attempts + 1;
    exit when attempts > 60;

    suffix    := lpad(floor(random() * 10000)::int::text, 4, '0');
    candidate := left(base, 25 - length(suffix) - 1) || '.' || suffix;
  end loop;

  return candidate;
end;
$function$;


-- Three tappable chips for the onboarding UI: the plain handle, the handle
-- with the campus slug (a huge amount of fresh namespace — rahul is taken
-- globally but rahul_iiitk almost certainly is not), and first-initial +
-- surname. Topped up with random-suffix candidates if any of those are gone.

create or replace function public.suggest_usernames(
  p_name          text,
  p_university_id uuid default null
)
  returns text[]
  language plpgsql
as $function$
declare
  out_arr   text[] := '{}';
  base      text;
  uni_slug  text;
  candidate text;
begin
  base := trim(both '.' from regexp_replace(lower(coalesce(p_name, 'student')), '[^a-z0-9]+', '.', 'g'));
  base := regexp_replace(base, '^[^a-z]+', '');   -- §3: must start with a letter
  base := left(base, 17);
  base := trim(both '.' from base);

  if length(base) < 3 then
    base := 'student';
  end if;

  select lower(regexp_replace(split_part(domain, '.', 1), '[^a-z0-9]', '', 'g'))
    into uni_slug
    from public.universities
   where id = p_university_id;

  -- 1. plain
  if public.is_username_available(base) then
    out_arr := out_arr || base;
  end if;

  -- 2. with campus
  if uni_slug is not null then
    candidate := left(base || '_' || uni_slug, 25);
    if public.is_username_available(candidate) then
      out_arr := out_arr || candidate;
    end if;
  end if;

  -- 3. first initial + surname
  candidate := regexp_replace(base, '^([a-z])[a-z0-9]*\.', '\1', '');
  if candidate <> base and public.is_username_available(candidate) then
    out_arr := out_arr || candidate;
  end if;

  -- top up with random suffixes until we have 3
  while array_length(out_arr, 1) is null or array_length(out_arr, 1) < 3 loop
    candidate := public.generate_username(p_name);

    if not (candidate = any(out_arr)) then
      out_arr := out_arr || candidate;
    end if;
  end loop;

  return out_arr[1:3];
end;
$function$;


-- Search. Exact match first, then own campus, then trigram similarity — a
-- student looking for a classmate almost always means someone on their own
-- campus, so that outranks a better fuzzy score from another university.
--
-- q is folded once at the top and every stored username is already lowercase
-- (§3), so no lower() is needed in the predicates. The prefix arm is the one
-- that uses users_username_prefix_idx from §4; the two `%` arms use the GIN
-- indexes, and those are case-blind regardless because pg_trgm lowercases its
-- input when it builds trigrams — which is what makes searching a mixed-case
-- full_name work.

create or replace function public.search_users(
  p_query  text,
  p_viewer uuid default null,
  p_limit  int  default 20
)
  returns table (
    id              uuid,
    username        text,
    full_name       text,
    avatar_url      text,
    university_name varchar,
    is_same_campus  boolean,
    rank            real
  )
  language plpgsql
  stable
as $function$
declare
  q          text := lower(trim(p_query));
  viewer_uni uuid;
begin
  select university_id into viewer_uni from public.users where users.id = p_viewer;

  return query
  select u.id, u.username, u.full_name, u.avatar_url,
         un.name as university_name,
         (u.university_id = viewer_uni) as is_same_campus,
         greatest(
           similarity(u.username, q),
           similarity(coalesce(u.full_name, ''), q)
         ) as rank
    from public.users u
    join public.universities un on un.id = u.university_id
   where u.username is not null
     and (u.username like q || '%'
          or u.username % q
          or coalesce(u.full_name, '') % q)
   order by
     (u.username = q) desc,
     (u.university_id = viewer_uni) desc,
     rank desc
   limit p_limit;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 8. Password plumbing.
--
-- No password column appears anywhere below. Supabase Auth owns the hash in
-- auth.users.encrypted_password, along with the bcrypt work factor, the
-- per-user salt and the timing-safe comparison. users.has_password (§2) is a
-- cache of "is that column populated", nothing more.
-- ---------------------------------------------------------------------------

-- supabase.auth.signInWithPassword() accepts an email or a phone number and
-- never a username, and there is no setting that changes it. This is the
-- bridge: username in, login email out. The identifier is folded before the
-- comparison, so a student typing RAHUL with caps lock on still signs in; the
-- stored side needs no fold because §3 guarantees it. public.users has no
-- email column — by
-- design, so a slightly wrong policy can never expose student emails — so the
-- lookup has to reach across into the auth schema, which is what SECURITY
-- DEFINER buys.
--
-- THE REVOKES BELOW ARE LOAD-BEARING. Without them, anyone holding the
-- publishable key can convert any public username into that student's private
-- email address — a mass email harvest of the entire student body. This is the
-- one function in the file where that matters, because it is the only one that
-- returns data the profile URL does not already expose.
--
-- FROM PUBLIC is required as well as FROM anon: Postgres grants EXECUTE to
-- PUBLIC by default and anon inherits it, so revoking only from anon leaves the
-- function wide open. docs/CURRENT_STATE.md item 2 records that we already
-- learned this the hard way on the existing functions.

create or replace function public.get_login_email(p_identifier text)
  returns text
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $function$
  select au.email
    from public.users u
    join auth.users au on au.id = u.id
   where u.username = lower(trim(p_identifier))
   limit 1;
$function$;

revoke execute on function public.get_login_email(text) from public;
revoke execute on function public.get_login_email(text) from anon, authenticated;


-- Login attempt log. The backend counts failed rows for an identifier over the
-- last 15 minutes and locks at 10.
--
-- ip_address is recorded for analysis but is NEVER what the lockout keys on.
-- Campus Wi-Fi NATs hundreds of students behind one address, so an IP lock
-- would take out a whole hostel because one person fat-fingered their password.

create table public.auth_attempts (
  id         uuid primary key default gen_random_uuid(),
  identifier text not null,
  ip_address text,
  succeeded  boolean not null,
  created_at timestamptz not null default now()
);

-- Partial index: the rate limiter only ever reads failures, so successes stay
-- out of the index entirely.
create index auth_attempts_failed_idx
  on public.auth_attempts (identifier, created_at desc)
  where succeeded = false;

create or replace function public.cleanup_auth_attempts()
  returns void
  language sql
as $function$
  delete from public.auth_attempts where created_at < now() - interval '30 days';
$function$;


-- ---------------------------------------------------------------------------
-- 9. handle_new_user — the profile row is created by the database now.
--
-- Today public.users rows are created only by JavaScript, in three places
-- (verifyOtp, demoLogin, seedDemo.js). Every future signup surface — mobile,
-- admin tooling, Google sign-in — is another chance to forget, and there is a
-- real race in verifyOtp: if the process dies between GoTrue creating the auth
-- user and the JS insert landing, that auth user has no profile forever. A
-- trigger runs inside the same transaction as the auth insert, so both happen
-- or neither does.
--
-- THREE PROPERTIES, ALL MANDATORY (runbook Part 0.5):
--
-- a) It must NEVER raise. If it throws, GoTrue fails the whole insert and the
--    student sees an opaque "Database error saving new user" with no route to
--    a fix — our friendly "Yahora is not yet available at your university"
--    would never render. Hence the catch-all at the bottom.
--
-- b) An unknown email domain still creates the row, with university_id NULL.
--    requestOtp already validates the domain before an OTP is ever sent, so by
--    the time an auth user exists the domain has been checked. university_id is
--    nullable; a NULL there is a monitoring signal that something created an
--    account through a path that skipped validation — not a failed signup.
--
-- c) It does NOT generate a username. There is no full_name at auth.users
--    insert time, and deriving one from the email local part would bake roll
--    numbers — which encode branch and batch year — into permanent public
--    handles. username stays NULL until onboarding, where the student picks it.
--
-- SECURITY DEFINER because GoTrue's internal role cannot write to public.users.
-- search_path is pinned per §5 of migration 003.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $function$
declare
  v_domain        text;
  v_university_id uuid;
begin
  v_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  select id
    into v_university_id
    from public.universities
   where lower(domain) = v_domain;

  insert into public.users (id, university_id, is_profile_complete)
  values (new.id, v_university_id, false)
  on conflict (id) do nothing;

  return new;

exception when others then
  -- Deliberately swallowed. See (a) above: a raising trigger breaks signup
  -- entirely. The JS upserts in verifyOtp/demoLogin remain as the fallback.
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 10. RLS on the three new tables.
--
-- Migration 003 revoked default privileges, so these tables were born with
-- zero anon/authenticated grants. All three are BACKEND-ONLY — nothing in
-- frontend/ or mobile/ queries them directly — so they get RLS on and stop
-- there.
--
-- Zero policies and zero grants is deliberate, not an omission: RLS with no
-- matching policy denies everything, and service_role has BYPASSRLS, so the
-- Express backend is completely unaffected. Same shape as §3 of migration 003.
-- ---------------------------------------------------------------------------

alter table public.reserved_usernames enable row level security;
alter table public.username_history   enable row level security;
alter table public.auth_attempts      enable row level security;
