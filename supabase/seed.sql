-- supabase/seed.sql
-- Runs automatically after every `supabase db reset`.
-- Reference data only. Never real user data.

-- FIXED 2026-08-12: the `id` column was added to this block. It used to be omitted, so these
-- two rows were inserted with gen_random_uuid() ids and took the unique `domain` values. The
-- fixed-id insert further down ("Layer 1") then collided on `universities_domain_key`, its
-- untargeted `on conflict do nothing` swallowed the collision, and a0000000-…-0001/0002 never
-- existed. Every seeded user then failed users_university_id_fkey and `supabase db reset`
-- aborted the whole seed. The same shape of trap is still live in the courses and
-- specializations blocks below — harmless today because nothing references those fixed ids.
INSERT INTO universities (id, name, domain) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'IIITDM Kurnool',     'iiitk.ac.in'),
  ('a0000000-0000-4000-8000-000000000002', 'NIET Greater Noida', 'niet.co.in'),
  ('a0000000-0000-4000-8000-000000000003', 'Yahora University (Demo)', 'demo.yahora.com'),
  ('a0000000-0000-4000-8000-000000000004', 'NIT Delhi', 'nitdelhi.ac.in'),
  ('a0000000-0000-4000-8000-000000000005', 'IIT Tirupati', 'iittp.ac.in')
ON CONFLICT (domain) DO NOTHING;

INSERT INTO courses (name) VALUES
  ('B.Tech'), ('M.Tech'), ('B.Des'), ('MBA'), ('PhD')
ON CONFLICT (name) DO NOTHING;

INSERT INTO specializations (name) VALUES
  ('Computer Science and Engineering'),
  ('Electronics and Communication Engineering'),
  ('Mechanical Engineering'),
  ('Design')
ON CONFLICT (name) DO NOTHING;

INSERT INTO visitor_metrics (id, view_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ============ Layer 1: reference data ============

insert into public.universities (id, name, domain) values
  ('a0000000-0000-4000-8000-000000000001', 'IIITDM Kurnool',     'iiitk.ac.in'),
  ('a0000000-0000-4000-8000-000000000002', 'NIET Greater Noida', 'niet.co.in'),
  ('a0000000-0000-4000-8000-000000000003', 'Yahora University (Demo)', 'demo.yahora.com'),
  ('a0000000-0000-4000-8000-000000000004', 'NIT Delhi', 'nitdelhi.ac.in'),
  ('a0000000-0000-4000-8000-000000000005', 'IIT Tirupati', 'iittp.ac.in')
on conflict do nothing;

insert into public.courses (id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'B.Tech'),
  ('c0000000-0000-4000-8000-000000000002', 'M.Tech')
on conflict do nothing;

insert into public.specializations (id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'Computer Science'),
  ('d0000000-0000-4000-8000-000000000002', 'Mechanical Engineering')
on conflict do nothing;

insert into public.visitor_metrics (id, view_count) values (1, 0)
on conflict do nothing;


-- ============ Layer 2: test accounts ============
-- A helper so we write the auth boilerplate once instead of eleven times.
--
-- Handles are passed in and HARDCODED, never generated. Stable-across-resets ids
-- are the whole point of this file, and generate_username() appends a random
-- suffix on collision — you would get a different handle every reset and any test
-- that hardcodes one would flake. Migration 006 requires a username on every row
-- with is_profile_complete = true, which is every account this helper creates.

create or replace function pg_temp.seed_user(
  p_id            uuid,
  p_email         text,
  p_password      text,
  p_full_name     text,
  p_username      text,
  p_university_id uuid
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  ) on conflict do nothing;

  -- MUST be do-update, not do-nothing. Migration 005 added an after-insert
  -- trigger on auth.users (handle_new_user) that creates this row first, with
  -- only id/university_id/is_profile_complete=false. `do nothing` therefore
  -- silently discarded the name, the handle and the completion flag, leaving
  -- every seeded student a nameless shell — the marketplace showed anonymous
  -- sellers and the 006 backfill had no completed rows to work on.
  insert into public.users (id, university_id, full_name, username, is_profile_complete)
  values (p_id, p_university_id, p_full_name, p_username, true)
  on conflict (id) do update set
    university_id       = excluded.university_id,
    full_name           = excluded.full_name,
    username            = excluded.username,
    is_profile_complete = excluded.is_profile_complete;
end;
$$;

-- IIITDM Kurnool
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000001', 'arjun@iiitk.ac.in',  'password123', 'Arjun Mehta',   'arjun.mehta', 'a0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000002', 'priya@iiitk.ac.in',  'password123', 'Priya Nair',    'priya.nair',  'a0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000003', 'rahul@iiitk.ac.in',  'password123', 'Rahul Verma',   'rahul.verma', 'a0000000-0000-4000-8000-000000000001');

-- NIET Greater Noida
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000004', 'sneha@niet.co.in',   'password123', 'Sneha Gupta',   'sneha.gupta', 'a0000000-0000-4000-8000-000000000002');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000005', 'karan@niet.co.in',   'password123', 'Karan Singh',   'karan.singh', 'a0000000-0000-4000-8000-000000000002');


-- ============ Layer 3: demo marketplace content ============
-- Local development data. Every id below is hand-assigned — no gen_random_uuid()
-- anywhere another row has to point at, so these ids are stable across resets and
-- safe to hardcode in a test or a curl.
--
-- Id prefixes, so a raw query result is readable:
--   a0…  university    b0…  user      e0…  product
--   e1…  comment       e2…  purchase  f0…  message
--
-- CAMPUS ISOLATION IS THE INVARIANT OF THIS PRODUCT. Every products / messages /
-- comments row carries a university_id, and it always equals the university of every
-- user the row touches. product_likes and product_saves have no university_id column,
-- so isolation there lives entirely in which pairs we choose — a Kurnool student never
-- likes a Noida listing. Keep it that way when you add rows.
--
-- products.likes_count and products.comments_count are DELIBERATELY absent from the
-- insert below. Triggers trg_update_likes_count and trg_update_comments_count maintain
-- them; seeding a value here as well would double-count.


-- ---- Products (12) ---------------------------------------------------------
-- 8 at IIITDM Kurnool (Arjun, Priya, Rahul), 4 at NIET Greater Noida (Sneha, Karan).
-- Categories are the eight in MARKETPLACE_CATEGORIES and conditions the five in
-- MARKETPLACE_CONDITIONS (mobile/src/lib/marketplace.ts) — all eight categories appear,
-- so every marketplace filter chip has something behind it. created_at is spread across
-- the "Posting date" buckets too: today / this week / this month / older.

insert into public.products
  (id, seller_id, university_id, title, description, price, category,
   image_urls, status, location, condition, views, created_at)
values
  -- Arjun Mehta — IIITDM Kurnool
  ('e0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Casio FX-991ES Plus Scientific Calculator',
   'Used it for two semesters of Engineering Maths. Every function works, no scratches on the screen. Slide-on cover included.',
   700.00, 'Electronics & Tech',
   array['https://placehold.co/600x400'],
   'available', 'Hostel Block B, Room 214', 'Like New', 143, now() - interval '3 hours'),

  ('e0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'HP Pavilion 15 — i5 11th Gen, 8GB RAM, 512GB SSD',
   'Bought in first year, upgrading to something with a dedicated GPU. Battery still holds about 4.5 hours. Charger and original box included, no dents.',
   28500.00, 'Electronics & Tech',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Boys Hostel, Block A', 'Good', 512, now() - interval '2 days'),

  ('e0000000-0000-4000-8000-000000000003',
   'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'SG Cricket Kit — bat, pads and gloves',
   'Full kit from last year inter-branch tournament. Small edge crack on the bat, taped and holding. Everything else is fine. Kit bag included.',
   3200.00, 'Sports & Fitness',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Sports Complex, near Ground 2', 'Fair', 88, now() - interval '12 days'),

  -- Priya Nair — IIITDM Kurnool
  ('e0000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Wacom Intuos S Drawing Tablet',
   'Bought for a design elective and barely touched it after the course ended. Pen, spare nibs and USB cable all included.',
   4200.00, 'Electronics & Tech',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Girls Hostel, Block C', 'Mint', 201, now() - interval '5 days'),

  ('e0000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'GATE CSE Made Easy Study Set (2024 edition)',
   'Ten subject-wise books plus the previous-year papers volume. Pencil notes in the DBMS and OS books, the rest are clean.',
   950.00, 'Books & Study Materials',
   array['https://placehold.co/600x400'],
   'available', 'Central Library, Reading Room 1', 'Good', 176, now() - interval '18 days'),

  ('e0000000-0000-4000-8000-000000000006',
   'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Foldable Study Table with Bookshelf',
   'Fits beside a hostel bed and folds flat when you go home for the break. Two shelves, no wobble. Buyer carries it down from the third floor.',
   1800.00, 'Furniture & Decor',
   array['https://placehold.co/600x400'],
   'available', 'Girls Hostel Block C, Room 108', 'Good', 64, now() - interval '41 days'),

  -- Rahul Verma — IIITDM Kurnool
  ('e0000000-0000-4000-8000-000000000007',
   'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Hero Sprint 26T Gear Cycle',
   'Serviced last month — new tyres and brake pads. All 21 gears shift cleanly. Selling because I graduate in May.',
   5500.00, 'Vehicles & Bikes',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Main Gate Cycle Stand', 'Good', 340, now() - interval '6 days'),

  ('e0000000-0000-4000-8000-000000000008',
   'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Bajaj 1.5L Electric Kettle',
   'Auto cut-off works, no leaks, built for 2am Maggi. Sold to a junior in Block A.',
   600.00, 'Appliances',
   array['https://placehold.co/600x400'],
   'sold', 'Hostel Block D, Pantry', 'Like New', 47, now() - interval '55 days'),

  -- Sneha Gupta — NIET Greater Noida
  ('e0000000-0000-4000-8000-000000000009',
   'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Canon EOS 1500D DSLR with 18-55mm Lens',
   'Shot two college fests with it, roughly 9000 shutter count. Kit lens, strap, charger and a 32GB card all included.',
   21000.00, 'Electronics & Tech',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Girls Hostel, NIET Campus', 'Good', 428, now() - interval '9 hours'),

  ('e0000000-0000-4000-8000-000000000010',
   'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Winter Jacket and Hoodie Bundle (Size M)',
   'One padded jacket and two hoodies, all size M. Survived one Noida winter, no tears or stains. Selling as a set only.',
   1200.00, 'Clothing & Accessories',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'Hostel Block 2, Common Room', 'Like New', 93, now() - interval '4 days'),

  -- Karan Singh — NIET Greater Noida
  ('e0000000-0000-4000-8000-000000000011',
   'b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'Honda Activa 5G (2019) — single owner',
   'About 24,000 km on the clock, every service done at the Honda centre in Knowledge Park. Insurance valid till March, papers clean. RC transfer on the buyer.',
   48000.00, 'Vehicles & Bikes',
   array['https://placehold.co/600x400', 'https://placehold.co/600x400'],
   'available', 'NIET Parking Lot B', 'Good', 690, now() - interval '21 days'),

  ('e0000000-0000-4000-8000-000000000012',
   'b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'Engineering Drawing Kit with Mini Drafter',
   'First-year drawing kit — mini drafter, set squares, compass box and a roll of unused sheets. Drafter clamp is a little stiff but holds fine.',
   550.00, 'Miscellaneous',
   array['https://placehold.co/600x400'],
   'available', 'Mechanical Department, Block C', 'Fair', 58, now() - interval '63 days')
on conflict do nothing;


-- ---- Purchase record for the one sold listing ------------------------------
-- markProductAsSold() (backend/src/modules/products/products.controller.js) sets
-- status='sold' AND writes a purchases row — that row is what the dashboard
-- "Purchases" tab reads. A sold product without one is a state the app never
-- produces, so seed both. Buyer Arjun is on the same campus as seller Rahul.

insert into public.purchases (id, buyer_id, product_id, created_at) values
  ('e2000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000008',
   now() - interval '52 days')
on conflict do nothing;


-- ---- Message threads (3) ---------------------------------------------------
-- Both participants of every thread are at the SAME university, and the thread's
-- university_id matches theirs. There is no cross-campus thread here and there must
-- never be one — messaging across campuses is the thing this product forbids.
-- Each thread's last message is delivered but unread, so the inbox shows a badge.

insert into public.messages
  (id, sender_id, receiver_id, university_id, product_id, content,
   is_delivered, is_read, created_at)
values
  -- Thread 1 · Arjun <-> Priya · IIITDM Kurnool · about the Wacom tablet
  ('f0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'Hi Priya! Is the Wacom tablet still available?',
   true, true, now() - interval '2 days 4 hours'),
  ('f0000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'Yes it is. Barely touched it after the design elective ended.',
   true, true, now() - interval '2 days 3 hours'),
  ('f0000000-0000-4000-8000-000000000003',
   'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'Would you take 3800 for it?',
   true, true, now() - interval '2 days 2 hours'),
  ('f0000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'I can do 4000 with the pen, spare nibs and the cable.',
   true, true, now() - interval '2 days 1 hour'),
  ('f0000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'Deal. Can I collect it from Block C tomorrow around 6?',
   true, true, now() - interval '1 day 20 hours'),
  ('f0000000-0000-4000-8000-000000000006',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'Works for me, I will wait at the hostel gate.',
   true, false, now() - interval '1 day 19 hours'),

  -- Thread 2 · Priya <-> Rahul · IIITDM Kurnool · about the gear cycle
  ('f0000000-0000-4000-8000-000000000007',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007',
   'Hey Rahul, saw the Hero Sprint listing. Any trouble with the gears?',
   true, true, now() - interval '1 day 8 hours'),
  ('f0000000-0000-4000-8000-000000000008',
   'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007',
   'Gears are fine, got it serviced last month. Tyres are new as well.',
   true, true, now() - interval '1 day 7 hours'),
  ('f0000000-0000-4000-8000-000000000009',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007',
   'Can I come see it at the cycle stand this evening?',
   true, true, now() - interval '1 day 6 hours'),
  ('f0000000-0000-4000-8000-000000000010',
   'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007',
   'Sure, I am free after 5. It is the blue one near the main gate.',
   true, true, now() - interval '1 day 5 hours'),
  ('f0000000-0000-4000-8000-000000000011',
   'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007',
   'Perfect, see you then.',
   true, false, now() - interval '1 day 4 hours'),

  -- Thread 3 · Sneha <-> Karan · NIET Greater Noida · about the Activa
  ('f0000000-0000-4000-8000-000000000012',
   'b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011',
   'Hi Karan, is the Activa still up for sale?',
   true, true, now() - interval '5 hours'),
  ('f0000000-0000-4000-8000-000000000013',
   'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011',
   'It is. Insurance is valid till March and the papers are clean.',
   true, true, now() - interval '4 hours 40 minutes'),
  ('f0000000-0000-4000-8000-000000000014',
   'b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011',
   'How many kilometres has it done?',
   true, true, now() - interval '4 hours'),
  ('f0000000-0000-4000-8000-000000000015',
   'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011',
   'Around 24,000. Every service done at the Honda centre in Knowledge Park.',
   true, true, now() - interval '3 hours 30 minutes'),
  ('f0000000-0000-4000-8000-000000000016',
   'b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000011',
   'Sounds good. Can we meet at the parking lot on Saturday?',
   true, false, now() - interval '3 hours')
on conflict do nothing;


-- ---- Comments (8, including 2 reply threads) -------------------------------
-- Every commenter is at the same university as the product they are commenting on,
-- and comments.university_id repeats it. The six top-level rows come first because
-- the two replies point at them via comments_parent_comment_id_fkey — a reply cannot
-- be inserted before its parent exists.
-- upvotes / downvotes are left at 0 on purpose: trg_update_comment_votes owns them.

insert into public.comments
  (id, product_id, user_id, university_id, content, parent_comment_id, created_at)
values
  -- top-level · IIITDM Kurnool
  ('e1000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   'Does it still hold charge for 4+ hours?',
   null, now() - interval '1 day 18 hours'),
  ('e1000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'Is the frame size okay for someone around 5 feet 10?',
   null, now() - interval '5 days'),
  ('e1000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001',
   'Are the 2024 papers in the set or does it stop at 2023?',
   null, now() - interval '15 days'),
  ('e1000000-0000-4000-8000-000000000004',
   'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   'This is a steal at 700, grab it before placement season starts.',
   null, now() - interval '2 hours'),

  -- top-level · NIET Greater Noida
  ('e1000000-0000-4000-8000-000000000005',
   'e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000002',
   'Does it come with the camera bag and the memory card?',
   null, now() - interval '7 hours'),
  ('e1000000-0000-4000-8000-000000000006',
   'e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000002',
   'Is the RC transfer cost included in the price?',
   null, now() - interval '19 days'),

  -- replies · each seller answering on their own listing, same campus as the parent
  ('e1000000-0000-4000-8000-000000000007',
   'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'Yes, about 4.5 hours on light use. Battery was replaced last year.',
   'e1000000-0000-4000-8000-000000000001', now() - interval '1 day 16 hours'),
  ('e1000000-0000-4000-8000-000000000008',
   'e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001',
   'Should be a good fit, I am 5 feet 11 and ride it comfortably.',
   'e1000000-0000-4000-8000-000000000002', now() - interval '4 days 20 hours')
on conflict do nothing;


-- ---- Likes and saves -------------------------------------------------------
-- Neither table has a university_id column, so campus isolation here is purely a
-- property of the pairs below: every user_id and product_id belong to the same
-- university, and nobody likes or saves their own listing.
-- These inserts are what fire trg_update_likes_count, which is why products.likes_count
-- is not seeded above.

insert into public.product_likes (user_id, product_id, created_at) values
  -- IIITDM Kurnool students on IIITDM Kurnool listings
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', now() - interval '2 hours'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000007', now() - interval '5 days'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', now() - interval '1 day 6 hours'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004', now() - interval '4 days'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000006', now() - interval '30 days'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', now() - interval '10 days'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000007', now() - interval '5 days 2 hours'),
  -- NIET Greater Noida students on NIET Greater Noida listings
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000011', now() - interval '15 days'),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000012', now() - interval '40 days'),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000009', now() - interval '6 hours'),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000010', now() - interval '3 days')
on conflict do nothing;

insert into public.product_saves (user_id, product_id, created_at) values
  -- IIITDM Kurnool
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', now() - interval '11 days'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', now() - interval '1 hour'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004', now() - interval '4 days'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', now() - interval '38 days'),
  -- NIET Greater Noida
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000011', now() - interval '15 days'),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000009', now() - interval '6 hours'),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000010', now() - interval '3 days')
on conflict do nothing;

-- ============ Layer 4: named test accounts + their listings ============
-- Six log-in-able accounts, one per person we actually test with, spread across all
-- four campuses. Password for every one of them is `password123`, same as Layer 2.
--
-- These fill the two campuses that had nobody on them: NIT Delhi and IIT Tirupati
-- existed as rows in `universities` but had zero users and zero products, so switching
-- to either one showed an empty marketplace.
--
-- The same person appears on two campuses on purpose (Vishwajeet at Kurnool AND
-- Tirupati, Neeraj at Noida AND Delhi). They are SEPARATE accounts with separate ids —
-- that is what lets you log in as one, switch campus, and confirm that browsing works
-- across campuses while liking / saving / messaging stays locked to your own.
--
-- Id blocks continue the existing series: users b0…0006-0011, products e0…0013-0024.

-- The two duplicated names get campus-suffixed handles. Usernames are globally
-- unique, so Vishwajeet-at-Kurnool and Vishwajeet-at-Tirupati cannot both be
-- `vishwajeet.singh` — and the suffix is what tells you which account you are
-- logged into when you are testing cross-campus browse.

select pg_temp.seed_user('b0000000-0000-4000-8000-000000000006', 'test@iiitk.ac.in',        'password123', 'Test Kurnool',     'test.kurnool',        'a0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000007', 'test@niet.co.in',         'password123', 'Test Noida',       'test.noida',          'a0000000-0000-4000-8000-000000000002');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000008', 'vishwajeet@iiitk.ac.in',  'password123', 'Vishwajeet Singh', 'vishwajeet.singh',    'a0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000009', 'neeraj@niet.co.in',       'password123', 'Neeraj Kumar',     'neeraj.kumar',        'a0000000-0000-4000-8000-000000000002');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000010', 'vishwajeet@iittp.ac.in',  'password123', 'Vishwajeet Singh', 'vishwajeet.tirupati', 'a0000000-0000-4000-8000-000000000005');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000011', 'neeraj@nitdelhi.ac.in',   'password123', 'Neeraj Kumar',     'neeraj.delhi',        'a0000000-0000-4000-8000-000000000004');


-- ---- Academic details -------------------------------------------------------
-- All six are B.Tech students. `qualification` is a plain string from the dropdown in
-- onboarding ("Graduation" is the B.Tech/B.Des tier — see QUALIFICATION_OPTIONS in
-- frontend/src/pages/onboarding/onboarding.jsx), while the branch itself is a foreign
-- key into `courses`.
--
-- course_id and specialization_id are looked up BY NAME, not hardcoded. The fixed
-- c0…/d0… ids further up this file never actually land: the legacy no-id inserts take
-- the unique `name` first, so the fixed-id insert hits `on conflict do nothing` and is
-- silently skipped. Writing 'c0000000-…-0001' here would be a dangling reference.

update public.users u set
  qualification      = 'Graduation',
  course_id          = (select id from public.courses         where name = 'B.Tech'),
  specialization_id  = (select id from public.specializations where name = 'Computer Science and Engineering'),
  year_of_study      = v.year,
  bio                = v.bio
from (values
  ('b0000000-0000-4000-8000-000000000006'::uuid, '2nd year', 'Testing account for IIITDM Kurnool. Ping me about anything in Hostel B.'),
  ('b0000000-0000-4000-8000-000000000007'::uuid, '2nd year', 'Testing account for NIET Greater Noida.'),
  ('b0000000-0000-4000-8000-000000000008'::uuid, '4th year', 'Final year B.Tech at IIITDM Kurnool. Clearing out four years of hostel life.'),
  ('b0000000-0000-4000-8000-000000000009'::uuid, '3rd year', 'B.Tech CSE at NIET. Buy my stuff, I need the shelf space.'),
  ('b0000000-0000-4000-8000-000000000010'::uuid, '3rd year', 'B.Tech at IIT Tirupati. Mostly here for the guitar and the cycle.'),
  ('b0000000-0000-4000-8000-000000000011'::uuid, '4th year', 'B.Tech at NIT Delhi. Graduating soon, everything must go.')
) as v(id, year, bio)
where u.id = v.id;


-- ---- Their listings (12) ----------------------------------------------------
-- Two per person. Every row's university_id equals its seller's university — the campus
-- isolation invariant described in Layer 3 applies here exactly the same way.
--
-- Images are real Unsplash photos rather than placehold.co, and each title describes
-- what is ACTUALLY in the picture — the photo behind "Apple iMac" really is an iMac, and
-- the barbell listing really is a barbell. If you swap an image, re-check the title with
-- it or the feed starts lying to you.
--
-- likes_count / comments_count are omitted on purpose (triggers own them). Dates are
-- spread over today / this week / this month / older so every "Posting date" filter
-- chip has something behind it.

insert into public.products
  (id, seller_id, university_id, title, description, price, category,
   image_urls, status, location, condition, views, created_at)
values
  -- Test Kurnool — IIITDM Kurnool
  ('e0000000-0000-4000-8000-000000000013',
   'b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Sony WH-1000XM4 Wireless Headphones',
   'Noise cancelling still works perfectly — I used these through two semesters of group study in the reading room. Carry case and charging cable included, earpads have no flaking.',
   14500.00, 'Electronics & Tech',
   array['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block B, Room 118', 'Like New', 218, now() - interval '5 hours'),

  ('e0000000-0000-4000-8000-000000000014',
   'b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Dell Inspiron 15 — 8GB RAM, 512GB SSD',
   'Solid everyday machine for coursework and coding labs. Battery gives about 4 hours now. Charger included, one small scuff on the lid that does not show when open.',
   24000.00, 'Electronics & Tech',
   array['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block B, Room 118', 'Good', 331, now() - interval '4 days'),

  -- Vishwajeet Singh — IIITDM Kurnool
  ('e0000000-0000-4000-8000-000000000015',
   'b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'MacBook Air M1 — 8GB, 256GB SSD',
   'Bought in second year, moving to a desktop setup after placement. Cycle count is low and the battery still lasts a full day of classes. Original charger and box included.',
   54000.00, 'Electronics & Tech',
   array['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800'],
   'available', 'Boys Hostel, Block A', 'Like New', 604, now() - interval '2 days'),

  ('e0000000-0000-4000-8000-000000000016',
   'b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'Startup and Business Book Bundle — 7 books',
   'Zero to One, The Obstacle Is the Way, Value Proposition Design, The Startup Owner''s Manual and three more. Read once each, no highlighting. Selling as one set only.',
   1400.00, 'Books & Study Materials',
   array['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800',
         'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800'],
   'available', 'Central Library, Reading Room 2', 'Good', 122, now() - interval '19 days'),

  -- Test Noida — NIET Greater Noida
  ('e0000000-0000-4000-8000-000000000017',
   'b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002',
   'Apple Magic Keyboard — Wireless',
   'Barely used, every key is crisp and the finish is unmarked. Pairs over Bluetooth and charges by Lightning cable, which is included.',
   4800.00, 'Electronics & Tech',
   array['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block 1, Room 305', 'Mint', 97, now() - interval '7 hours'),

  ('e0000000-0000-4000-8000-000000000018',
   'b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002',
   'Nike Free RN Running Shoes — UK 9',
   'Worn for one semester of morning runs around the campus loop. Sole has plenty left, no tears in the knit. Cleaned before listing.',
   2600.00, 'Clothing & Accessories',
   array['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block 1, Room 305', 'Like New', 154, now() - interval '9 days'),

  -- Neeraj Kumar — NIET Greater Noida
  ('e0000000-0000-4000-8000-000000000019',
   'b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000002',
   'Apple iMac 21.5-inch (2017)',
   'All-in-one desktop, great for a shared room where a tower will not fit. Screen has no dead pixels. Comes with the keyboard and mouse in the photo.',
   38000.00, 'Electronics & Tech',
   array['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800'],
   'available', 'Boys Hostel Block 2, Room 44', 'Good', 412, now() - interval '12 days'),

  ('e0000000-0000-4000-8000-000000000020',
   'b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000002',
   'Wilson NCAA Football',
   'Match ball from last year''s inter-branch tournament. Holds air fine, stitching is intact, just scuffed from being played on grass. Pump not included.',
   900.00, 'Sports & Fitness',
   array['https://images.unsplash.com/photo-1552318965-6e6be7484ada?auto=format&fit=crop&q=80&w=800'],
   'available', 'Sports Ground, near the pavilion', 'Good', 76, now() - interval '34 days'),

  -- Vishwajeet Singh — IIT Tirupati
  ('e0000000-0000-4000-8000-000000000021',
   'b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000005',
   'Acoustic Guitar — full size, with gig bag',
   'Learnt on this one and have upgraded. Action is comfortable, no fret buzz, tuning holds. New strings put on last month. Padded gig bag included.',
   5200.00, 'Miscellaneous',
   array['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block C, Music Room', 'Good', 189, now() - interval '3 hours'),

  ('e0000000-0000-4000-8000-000000000022',
   'b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000005',
   'Study Desk with Office Chair',
   'Selling the desk and the chair together. Desk is wide enough for a monitor plus notes, chair height adjusts and the castors roll smoothly. Buyer arranges pickup from the third floor.',
   6500.00, 'Furniture & Decor',
   array['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Block C, Room 312', 'Good', 143, now() - interval '16 days'),

  -- Neeraj Kumar — NIT Delhi
  ('e0000000-0000-4000-8000-000000000023',
   'b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000004',
   'Single-Speed City Bicycle',
   'Light, quick and perfect for getting to the department in five minutes. Serviced last month with new brake pads. Both tyres hold air properly.',
   7800.00, 'Vehicles & Bikes',
   array['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=800'],
   'available', 'Cycle Stand, near Main Gate', 'Good', 287, now() - interval '6 days'),

  ('e0000000-0000-4000-8000-000000000024',
   'b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000004',
   'Olympic Barbell with 40kg Weight Plates',
   'Bar plus 40kg of plates. Bar has surface rust near the sleeves that does not affect the spin. Heavy — bring a friend and something with wheels.',
   6200.00, 'Sports & Fitness',
   array['https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&q=80&w=800'],
   'available', 'Hostel Gym, Block D basement', 'Fair', 168, now() - interval '58 days')
on conflict do nothing;
