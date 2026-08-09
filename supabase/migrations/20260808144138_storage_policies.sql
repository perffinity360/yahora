-- ============================================================
-- storage_policies.sql
--
-- Storage policies live in the `storage` schema, which
-- `supabase db pull` does not capture. This file is their home
-- in version control from now on.
--
-- Two changes vs. what is currently in production:
--   1. Product uploads: TO public  ->  TO authenticated
--      (TO public included the anon role, so anyone on the
--       internet could upload into our bucket)
--   2. New `posts` bucket for community post images (Phase 6)
-- ============================================================

-- ------------------------------------------------------------
-- PRODUCTS bucket
-- ------------------------------------------------------------

-- Replace the old, over-permissive upload policy.
-- IF EXISTS so this file also runs cleanly on a fresh local DB,
-- where the old policy was never created.
DROP POLICY IF EXISTS "Allow product uploads" ON storage.objects;

CREATE POLICY "Authenticated product uploads"
  ON storage.objects FOR INSERT
  TO authenticated                          -- was: TO public
  WITH CHECK (bucket_id = 'products');

-- Reads stay public on purpose: link previews and OG images are
-- fetched by WhatsApp/Twitter servers that have no login.
DROP POLICY IF EXISTS "Allow product image viewing" ON storage.objects;

CREATE POLICY "Public product image viewing"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'products');

-- Let a seller delete their own uploaded images.
DROP POLICY IF EXISTS "Owner product image delete" ON storage.objects;

CREATE POLICY "Owner product image delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND owner = auth.uid());

-- ------------------------------------------------------------
-- POSTS bucket  (needed from Phase 6 — community post images)
-- ------------------------------------------------------------

-- Create the bucket. public = true means files are readable via a
-- plain URL without a signed token, same as products.
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated post uploads" ON storage.objects;

CREATE POLICY "Authenticated post uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'posts');

DROP POLICY IF EXISTS "Public post image viewing" ON storage.objects;

CREATE POLICY "Public post image viewing"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Owner post image delete" ON storage.objects;

CREATE POLICY "Owner post image delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'posts' AND owner = auth.uid());