-- ============================================================
-- performance_and_grants.sql
--
-- 1. Indexes on every foreign key and hot query path. Postgres
--    does NOT create an index for a foreign key automatically —
--    only for PRIMARY KEY and UNIQUE. Every FK in this schema was
--    therefore unindexed, which makes both the join and the
--    ON DELETE CASCADE check a sequential scan.
-- 2. Revoke function grants that should never have reached the
--    anon role.
--
-- All indexes use IF NOT EXISTS so this file is safe to re-run.
-- Plain CREATE INDEX, not CONCURRENTLY: migrations run inside a
-- transaction and CONCURRENTLY is not permitted there. These
-- tables are small enough that the brief write lock is fine.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Foreign keys and hot query paths
-- ------------------------------------------------------------

-- The marketplace feed. GET /api/products filters university_id +
-- status='available' and orders by created_at DESC — all three
-- columns in one index, so it is a single index scan.
CREATE INDEX IF NOT EXISTS products_campus_feed_idx
  ON products (university_id, status, created_at DESC);

-- FK products.seller_id. Serves the seller's own listings on
-- GET /api/user/:userId/dashboard and /public, and the cascade
-- check when a user is deleted.
CREATE INDEX IF NOT EXISTS products_seller_id_idx
  ON products (seller_id);

-- FK messages.sender_id / receiver_id. Serves the get_user_inbox()
-- RPC, which scans every message where the user is either party,
-- and PUT /api/messages/read + /deliver, which filter on
-- receiver_id. created_at DESC matches the "latest message per
-- conversation" ordering inside the RPC.
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_receiver_idx
  ON messages (receiver_id, created_at DESC);

-- FK messages.product_id. Serves GET /api/messages/history, which
-- filters product_id first, and the ON DELETE SET NULL fired when
-- a product is deleted.
CREATE INDEX IF NOT EXISTS messages_product_id_idx
  ON messages (product_id);

-- FK comments.product_id. Serves the comments join on
-- GET /api/products/:id. Stored ascending; Postgres reads the same
-- index backwards for that endpoint's created_at DESC ordering.
CREATE INDEX IF NOT EXISTS comments_product_idx
  ON comments (product_id, created_at);

-- FK comments.user_id. Cascade check when a user is deleted.
CREATE INDEX IF NOT EXISTS comments_user_id_idx
  ON comments (user_id);

-- FK comments.parent_comment_id. Self-referencing, so this serves
-- both reply lookups and the cascade when a parent is deleted.
CREATE INDEX IF NOT EXISTS comments_parent_comment_id_idx
  ON comments (parent_comment_id);

-- FK comments.university_id. Cascade check only; no endpoint
-- filters comments by campus today.
CREATE INDEX IF NOT EXISTS comments_university_id_idx
  ON comments (university_id);

-- FK posts.university_id. The campus community feed (Phase 6) will
-- filter university_id and order created_at DESC.
CREATE INDEX IF NOT EXISTS posts_campus_idx
  ON posts (university_id, created_at DESC);

-- FK posts.author_id. A user's own posts, and the cascade check.
CREATE INDEX IF NOT EXISTS posts_author_id_idx
  ON posts (author_id);

-- FK purchases.buyer_id. Serves the purchases list on
-- GET /api/user/:userId/dashboard.
CREATE INDEX IF NOT EXISTS purchases_buyer_id_idx
  ON purchases (buyer_id);

-- FK purchases.product_id. Serves POST /api/products/:id/available,
-- which deletes purchase rows by product, and the cascade when a
-- product is deleted.
CREATE INDEX IF NOT EXISTS purchases_product_id_idx
  ON purchases (product_id);

-- FK users.university_id. Every campus-scoped join reaches users
-- through this column; it is also the RESTRICT check that runs
-- before a university can be deleted.
CREATE INDEX IF NOT EXISTS users_university_id_idx
  ON users (university_id);

-- FK users.course_id / specialization_id. Serves the joins on
-- GET /api/user/:userId/dashboard and /public, and the
-- ON DELETE SET NULL when a course or specialization is removed.
CREATE INDEX IF NOT EXISTS users_course_id_idx
  ON users (course_id);

CREATE INDEX IF NOT EXISTS users_specialization_id_idx
  ON users (specialization_id);


-- ------------------------------------------------------------
-- 2. Reverse-direction lookups the composite primary keys cannot
--    serve
--
-- A composite PK is one index ordered by its columns left to
-- right, so it can only be seeked on a leading prefix. PK
-- (user_id, product_id) answers "what has this user liked?" but
-- NOT "who liked this product?" — that is a sequential scan. Each
-- index below covers the trailing column so the reverse question
-- is indexed too.
-- ------------------------------------------------------------

-- PK is (user_id, product_id). This serves lookups by product:
-- the cascade when a product is deleted, and the likes_count
-- recount done by the trg_update_likes_count trigger.
CREATE INDEX IF NOT EXISTS product_likes_product_id_idx
  ON product_likes (product_id);

-- PK is (user_id, product_id). Serves the cascade when a product
-- is deleted.
CREATE INDEX IF NOT EXISTS product_saves_product_id_idx
  ON product_saves (product_id);

-- PK is (comment_id, user_id). Serves "which comments has this
-- user voted on?" — the per-user vote lookup on
-- GET /api/products/:id — and the cascade when a user is deleted.
CREATE INDEX IF NOT EXISTS comment_votes_user_id_idx
  ON comment_votes (user_id);


-- ------------------------------------------------------------
-- 3. Grant fixes
--
-- These three functions were granted to anon, which is the key
-- shipped inside the web bundle and the mobile app. Nothing that
-- deletes accounts or edits counters should be callable by an
-- anonymous caller holding a public key.
-- ------------------------------------------------------------

-- SECURITY DEFINER, and it DELETEs from auth.users. Only the
-- backend cron (service_role) may call it.
REVOKE ALL ON FUNCTION public.cleanup_demo_users() FROM anon, authenticated;

-- Writes products.likes_count directly. Both are already dead code
-- — the trg_update_likes_count trigger maintains the counter — but
-- while they exist, anon must not be able to inflate or zero a
-- seller's like count at will.
REVOKE ALL ON FUNCTION public.increment_product_likes(uuid) FROM anon;

REVOKE ALL ON FUNCTION public.decrement_product_likes(uuid) FROM anon;


-- ------------------------------------------------------------
-- 4. The revokes above are not enough on their own
--
-- When PostgreSQL creates a function it automatically grants
-- EXECUTE on it to the special role PUBLIC. PUBLIC is not a role
-- you can add members to — it means "every role that exists or
-- ever will exist", and every role inherits its privileges
-- implicitly. anon is therefore able to execute these functions
-- through PUBLIC even after the explicit grant to anon is
-- revoked, because REVOKE only removes the privilege it names.
--
-- So `REVOKE ... FROM anon` above silently did nothing: it took
-- away a grant that was redundant, and left the inherited one in
-- place. The privilege has to be taken from PUBLIC itself.
--
-- service_role keeps its access: the baseline migration issues an
-- explicit GRANT ALL ... TO service_role on each of these, and
-- revoking from PUBLIC does not touch an explicit grant to a named
-- role. The demo-cleanup cron in backend/src/utils/cronJobs.js
-- uses the service-role client, so it is unaffected.
--
-- NOT revoked here, deliberately: increment_page_view() and
-- increment_product_views(uuid). Both are called from frontend/
-- with the anon key. Revoking them would break the footer visitor
-- counter and the product view counter.
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.cleanup_demo_users()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_likes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_likes(uuid) FROM PUBLIC;
