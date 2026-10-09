-- docs/runbooks/phase6a-vd-production-repair.sql
--
-- Phase 6A · Block V-D · one-off repair of the PRODUCTION demo tenant.
-- Written by Vishwajeet's session. NOT run by Claude. A human runs it, in the
-- Supabase SQL editor for production, one step at a time, reading each result
-- before moving on.
--
-- WHY THIS EXISTS
-- seedDemo.js skips a product when a row with the same title already exists on
-- the demo university. Block V-D changed four demo products in the script:
--   · two were REPLACED (new title, description, price and photos):
--       DSA Made Easy — Narasimha Karumanchi (Latest Edition)
--         -> DSA Handwritten Notes — Full Semester, Spiral-Bound
--       Nike Dri-FIT Oversized Hoodie — Olive Green, Size L
--         -> Foldable Umbrella — black
--   · two kept their titles and only got new photos, because their Unsplash
--     links died (photo-1527443224154 and photo-1615224143859):
--       Samsung 24" FHD IPS Monitor — HDMI + VGA
--       Philips Dry Iron + Usha Room Heater — Winter Bundle
-- Re-running seedDemo.js on production would therefore leave the two old rows
-- in place AND add two new ones, and would never touch the dead photos. This
-- file fixes the four existing rows in place instead: same ids, same sellers,
-- same likes, comments, saves and dates.
--
-- SCOPE: exact title AND the demo university (domain 'demo.yahora.com'). No
-- LIKE, no pattern, no other campus. Every value below is byte-identical to
-- backend/scripts/seedDemo.js after Block V-D.
--
-- Run step (a), check both results, then (b), then (c). If (a) does not match
-- its expectation exactly, STOP and do not run (b).


-- ---- (a) BEFORE --------------------------------------------------------------

-- (a.1) The four rows to be repaired.  Expected: exactly 4 rows.
select title, price, image_urls
from public.products
where university_id = (select id from public.universities where domain = 'demo.yahora.com')
  and title in ('DSA Made Easy — Narasimha Karumanchi (Latest Edition)',
                'Nike Dri-FIT Oversized Hoodie — Olive Green, Size L',
                'Samsung 24" FHD IPS Monitor — HDMI + VGA',
                'Philips Dry Iron + Usha Room Heater — Winter Bundle')
order by title;

-- (a.2) The two NEW titles must not exist yet.  Expected: 0.
--       Anything else means seedDemo.js has already been re-run here; stop and
--       look before updating, or the demo will hold the new product twice.
select count(*) as new_titles_already_present
from public.products
where university_id = (select id from public.universities where domain = 'demo.yahora.com')
  and title in ('DSA Handwritten Notes — Full Semester, Spiral-Bound',
                'Foldable Umbrella — black');


-- ---- (b) THE REPAIR ------------------------------------------------------------
-- One statement. For the two replaced products it sets title, description,
-- price and image_urls. For Samsung and Philips the first three are NULL in the
-- VALUES list, so coalesce() leaves title, description and price as they are
-- and only image_urls changes.
--
-- Expected: 4 rows returned.

update public.products p
set title       = coalesce(v.new_title,       p.title),
    description = coalesce(v.new_description, p.description),
    price       = coalesce(v.new_price,       p.price),
    image_urls  = v.new_image_urls
from (values
    ('DSA Made Easy — Narasimha Karumanchi (Latest Edition)'::text,
     'DSA Handwritten Notes — Full Semester, Spiral-Bound'::text,
     'Complete DSA notes from my third semester, handwritten on squared paper in one spiral-bound notebook — arrays through graphs, with worked examples and past exam questions. Neat handwriting, every page intact, and far quicker to revise from than a 900-page textbook.'::text,
     150::numeric,
     array['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Pen-writing-notes-studying.jpg/960px-Pen-writing-notes-studying.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail']::text[]),
    ('Nike Dri-FIT Oversized Hoodie — Olive Green, Size L'::text,
     'Foldable Umbrella — black'::text,
     'Compact black umbrella that folds small enough for a laptop bag, with a reflective trim that helps on dark walks back from the library. Used through one monsoon; every rib opens fully and the handle strap is intact.'::text,
     200::numeric,
     array['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Black_umbrella.jpg/960px-Black_umbrella.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail']::text[]),
    ('Samsung 24" FHD IPS Monitor — HDMI + VGA',
     null, null, null,
     array['https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Samsung_Monitor_1_2018-12-18.jpg/960px-Samsung_Monitor_1_2018-12-18.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail']::text[]),
    ('Philips Dry Iron + Usha Room Heater — Winter Bundle',
     null, null, null,
     array['https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Iron_box_block.jpg/960px-Iron_box_block.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', 'https://live.staticflickr.com/2191/2398676928_7b5772767a_b.jpg']::text[])
) as v(old_title, new_title, new_description, new_price, new_image_urls)
where p.title = v.old_title
  and p.university_id = (select id from public.universities where domain = 'demo.yahora.com')
returning p.title, p.price, p.image_urls;


-- ---- (c) AFTER -----------------------------------------------------------------
-- The four FINAL titles.  Expected: exactly 4 rows, image_urls exactly as in
-- step (b), and no images.unsplash.com link left in any of them.

select title, price, image_urls
from public.products
where university_id = (select id from public.universities where domain = 'demo.yahora.com')
  and title in ('DSA Handwritten Notes — Full Semester, Spiral-Bound',
                'Foldable Umbrella — black',
                'Samsung 24" FHD IPS Monitor — HDMI + VGA',
                'Philips Dry Iron + Usha Room Heater — Winter Bundle')
order by title;
