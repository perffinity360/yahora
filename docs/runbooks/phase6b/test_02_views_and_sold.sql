\set ON_ERROR_STOP on
begin;
do $$
declare
  arjun uuid := 'b0000000-0000-4000-8000-000000000001';   -- IIITDM Kurnool
  priya uuid := 'b0000000-0000-4000-8000-000000000002';   -- IIITDM Kurnool
  rahul uuid := 'b0000000-0000-4000-8000-000000000003';   -- IIITDM Kurnool
  karan uuid := 'b0000000-0000-4000-8000-000000000005';   -- NIET (other campus)
  p_wacom uuid := 'e0000000-0000-4000-8000-000000000004'; -- seller priya
  p_cycle uuid := 'e0000000-0000-4000-8000-000000000007'; -- seller rahul
  demo_uni uuid; demo_user uuid := '00000000-0000-4000-8000-00000000d001';
  demo_prod uuid; v0 int; v1 int; r boolean; ok boolean; p public.products; n int;
begin
  -- a demo-campus account and listing, like production has
  select id into demo_uni from universities where is_demo;
  insert into auth.users (id, email) values (demo_user, 'guest_1@demo.yahora.com');
  update users set university_id = demo_uni where id = demo_user;
  insert into products (seller_id, university_id, title, price, category, image_urls)
  values (demo_user, demo_uni, 'Demo lamp', 100, 'Misc', array['x']) returning id into demo_prod;

  -- ── views ──
  select views into v0 from products where id = p_wacom;
  r := record_product_view(p_wacom, arjun);  assert r, 'V1 first view counts';
  r := record_product_view(p_wacom, arjun);  assert not r, 'V2 second view by same person does not';
  r := record_product_view(p_wacom, priya);  assert not r, 'V3 seller own view does not';
  r := record_product_view(p_wacom, karan);  assert r, 'V4 other-campus student counts';
  r := record_product_view(p_wacom, demo_user); assert not r, 'V5 demo account on a real listing does not';
  r := record_product_view(demo_prod, arjun);   assert not r, 'V6 real student on a demo listing does not';
  r := record_product_view('00000000-0000-4000-8000-000000000000', arjun); assert not r, 'V7 unknown listing';
  select views into v1 from products where id = p_wacom;
  assert v1 = v0 + 2, format('V8 views went up by exactly 2 (was %s, now %s)', v0, v1);
  raise notice 'views ok: distinct viewers only; seller, repeats and cross-world views ignored';

  -- ── mark sold ──
  ok := false; begin perform mark_product_sold(p_wacom, arjun, rahul);
  exception when others then ok := sqlerrm = 'NOT_PRODUCT_OWNER'; end; assert ok, 'S1 not owner';
  ok := false; begin perform mark_product_sold(p_wacom, priya, priya);
  exception when others then ok := sqlerrm = 'BUYER_IS_SELLER'; end; assert ok, 'S2 buyer is seller';
  ok := false; begin perform mark_product_sold(p_wacom, priya, karan);
  exception when others then ok := sqlerrm = 'BUYER_NOT_ON_CAMPUS'; end; assert ok, 'S3 buyer other campus';
  ok := false; begin perform mark_product_sold(p_wacom, priya, demo_user);
  exception when others then ok := sqlerrm = 'BUYER_NOT_ON_CAMPUS'; end; assert ok, 'S3b demo buyer';
  ok := false; begin perform mark_product_sold(p_wacom, priya, '00000000-0000-4000-8000-000000000000');
  exception when others then ok := sqlerrm = 'BUYER_NOT_FOUND'; end; assert ok, 'S4 unknown buyer';
  ok := false; begin perform mark_product_sold('00000000-0000-4000-8000-000000000000', priya, null);
  exception when others then ok := sqlerrm = 'PRODUCT_NOT_FOUND'; end; assert ok, 'S5 unknown product';

  p := mark_product_sold(p_wacom, priya, arjun);
  assert p.status = 'sold' and p.sold_at is not null, 'S6 sold with stamp';
  assert (select buyer_id from purchases where product_id = p_wacom) = arjun, 'S6 purchase row';
  -- change the buyer: still one row, sold_at kept
  perform pg_sleep(0.01);
  p := mark_product_sold(p_wacom, priya, rahul);
  assert (select count(*) from purchases where product_id = p_wacom) = 1, 'S7 one row';
  assert (select buyer_id from purchases where product_id = p_wacom) = rahul, 'S7 buyer changed';
  -- sold to someone not on Yahora: no row
  p := mark_product_sold(p_wacom, priya, null);
  assert not exists (select 1 from purchases where product_id = p_wacom), 'S8 off-platform: no buyer';
  -- unique constraint is real
  insert into purchases (buyer_id, product_id) values (arjun, p_wacom);
  ok := false; begin insert into purchases (buyer_id, product_id) values (rahul, p_wacom);
  exception when unique_violation then ok := true; end; assert ok, 'S9 one purchase per listing';
  -- that wasn't me
  ok := false; begin perform remove_my_purchase(p_wacom, rahul);
  exception when others then ok := sqlerrm = 'PURCHASE_NOT_FOUND'; end; assert ok, 'S10 not your purchase';
  perform remove_my_purchase(p_wacom, arjun);
  assert not exists (select 1 from purchases where product_id = p_wacom), 'S11 removed';
  assert (select status from products where id = p_wacom) = 'sold', 'S11 still sold';
  -- relist clears sold_at and the buyer
  perform mark_product_sold(p_wacom, priya, arjun);
  p := mark_product_available(p_wacom, priya);
  assert p.status = 'available' and p.sold_at is null, 'S12 relisted, stamp cleared';
  assert not exists (select 1 from purchases where product_id = p_wacom), 'S12 buyer removed';
  ok := false; begin perform mark_product_available(p_wacom, arjun);
  exception when others then ok := sqlerrm = 'NOT_PRODUCT_OWNER'; end; assert ok, 'S13 relist not owner';
  raise notice 'mark sold ok: owner-only, same-campus buyer, one buyer, off-platform, not-me, relist';

  -- ── buyer candidates ──
  ok := false; begin perform get_product_buyer_candidates(p_wacom, arjun);
  exception when others then ok := sqlerrm = 'NOT_PRODUCT_OWNER'; end; assert ok, 'C1 only the seller';
  select count(*) into n from get_product_buyer_candidates(p_wacom, priya);
  assert n = 1, format('C2 one person messaged priya about the wacom, got %s', n);
  assert (select username from get_product_buyer_candidates(p_wacom, priya)) = 'arjun.mehta', 'C3 it is arjun';
  raise notice 'buyer candidates ok';
end $$;

\echo '--- privileges (all false expected)'
select has_function_privilege('anon', 'public.increment_product_views(uuid)', 'execute') as anon_old_views,
       has_function_privilege('authenticated', 'public.record_product_view(uuid,uuid)', 'execute') as auth_views,
       has_function_privilege('anon', 'public.mark_product_sold(uuid,uuid,uuid)', 'execute') as anon_sold,
       has_function_privilege('authenticated', 'public.get_product_buyer_candidates(uuid,uuid)', 'execute') as auth_candidates,
       has_table_privilege('anon', 'public.product_views', 'insert') as anon_views_table;
\echo '--- service_role keeps the old function until the new backend ships (true expected)'
select has_function_privilege('service_role', 'public.increment_product_views(uuid)', 'execute') as service_old_views;
rollback;
