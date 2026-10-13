-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 6B · Block V-D · Mark as Sold, reworked
--
-- The real scenario: a classmate sees a listing on Yahora, then finds the
-- seller in class or on WhatsApp, and the sale happens offline. The seller then
-- marks it sold. So marking sold must NOT depend on a conversation having
-- happened, the buyer is found by search, "someone not on Yahora" is a normal
-- answer, and a person tagged by mistake can remove themselves.
--
--   1. One buyer per listing: a unique constraint on purchases.product_id.
--   2. products.sold_at — stamped by a trigger whenever status becomes 'sold',
--      cleared when it stops being sold. No caller has to remember it.
--   3. products.sold_to is dropped. Nothing ever wrote it; the website's card
--      read it and always fell through to "SOLD".
--   4. Four functions hold every rule, so web, mobile and any future admin
--      tool behave identically:
--        mark_product_sold(product, seller, buyer or NULL)
--        mark_product_available(product, seller)
--        remove_my_purchase(product, buyer)            — "That wasn't me"
--        get_product_buyer_candidates(product, seller) — people who messaged
--                                                        the seller about it
--
-- Errors (mapped to HTTP by utils/respond.js):
--   PRODUCT_NOT_FOUND, NOT_PRODUCT_OWNER, BUYER_NOT_FOUND, BUYER_IS_SELLER,
--   BUYER_NOT_ON_CAMPUS, PURCHASE_NOT_FOUND
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. purchases: clean up, then one row per listing
-- ---------------------------------------------------------------------------

-- Rows that point at nothing are not a purchase of anything.
delete from public.purchases where buyer_id is null or product_id is null;

-- Before today, marking a listing sold twice inserted a second row. Keep the
-- newest row per listing and delete the older ones.
delete from public.purchases older
 using public.purchases newer
 where newer.product_id = older.product_id
   and (coalesce(newer.created_at, '-infinity'), newer.id)
     > (coalesce(older.created_at, '-infinity'), older.id);

alter table public.purchases
  alter column buyer_id   set not null,
  alter column product_id set not null;

-- A CONSTRAINT, not just an index: PostgREST reads unique constraints to know
-- that a listing has at most one purchase.
alter table public.purchases
  add constraint purchases_product_id_key unique (product_id);

-- The constraint's own index replaces the old non-unique one.
drop index if exists public.purchases_product_id_idx;

-- ---------------------------------------------------------------------------
-- 2. products.sold_at, kept true by a trigger
-- ---------------------------------------------------------------------------
alter table public.products add column sold_at timestamptz;

comment on column public.products.sold_at is
  'When the listing was marked sold. Set by trg_stamp_product_sold_at whenever '
  'status becomes ''sold''; cleared when it stops being sold. Never written by '
  'the backend.';

-- Listings already sold get a best guess: when their purchase was recorded,
-- otherwise when they were listed.
update public.products p
   set sold_at = coalesce(
         (select max(pu.created_at) from public.purchases pu where pu.product_id = p.id),
         p.created_at)
 where p.status = 'sold';

create or replace function public.stamp_product_sold_at()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $function$
begin
  if new.status = 'sold' then
    -- Becoming sold now (or inserted already sold): stamp it. Staying sold
    -- (e.g. the seller changes the buyer): keep the original moment.
    if tg_op = 'INSERT' or old.status is distinct from 'sold' then
      new.sold_at := coalesce(new.sold_at, now());
    end if;
  else
    new.sold_at := null;
  end if;
  return new;
end;
$function$;

create trigger trg_stamp_product_sold_at
  before insert or update of status on public.products
  for each row execute function public.stamp_product_sold_at();

-- The public profile lists a seller's sold items newest first.
create index products_seller_sold_idx
  on public.products (seller_id, sold_at desc)
  where status = 'sold';

-- ---------------------------------------------------------------------------
-- 3. sold_to: never written by anything — drop it
-- ---------------------------------------------------------------------------
alter table public.products drop column if exists sold_to;

-- ---------------------------------------------------------------------------
-- 4. The rules
-- ---------------------------------------------------------------------------

-- Mark sold. p_buyer_id NULL = "someone not on Yahora" (no one is tagged).
-- Calling it again on a sold listing changes the buyer; sold_at is kept.
create or replace function public.mark_product_sold(
  p_product_id uuid,
  p_seller_id  uuid,
  p_buyer_id   uuid default null
)
  returns public.products
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_product   public.products;
  v_buyer_uni uuid;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_product.seller_id is distinct from p_seller_id then
    raise exception 'NOT_PRODUCT_OWNER' using errcode = 'P0001';
  end if;

  if p_buyer_id is not null then
    if p_buyer_id = p_seller_id then
      raise exception 'BUYER_IS_SELLER' using errcode = 'P0001';
    end if;

    select university_id into v_buyer_uni from public.users where id = p_buyer_id;
    if not found then
      raise exception 'BUYER_NOT_FOUND' using errcode = 'P0001';
    end if;

    -- Buying is an interaction, and interaction is same-campus only. NULL on
    -- either side is a mismatch, not a pass.
    if v_buyer_uni is null or v_buyer_uni is distinct from v_product.university_id then
      raise exception 'BUYER_NOT_ON_CAMPUS' using errcode = 'P0001';
    end if;
  end if;

  update public.products
     set status = 'sold'
   where id = p_product_id
  returning * into v_product;

  delete from public.purchases where product_id = p_product_id;

  if p_buyer_id is not null then
    insert into public.purchases (buyer_id, product_id)
    values (p_buyer_id, p_product_id);
  end if;

  return v_product;
end;
$function$;

-- Relist. The buyer, if any, is removed.
create or replace function public.mark_product_available(
  p_product_id uuid,
  p_seller_id  uuid
)
  returns public.products
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_product public.products;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_product.seller_id is distinct from p_seller_id then
    raise exception 'NOT_PRODUCT_OWNER' using errcode = 'P0001';
  end if;

  update public.products
     set status = 'available'
   where id = p_product_id
  returning * into v_product;

  delete from public.purchases where product_id = p_product_id;

  return v_product;
end;
$function$;

-- "That wasn't me": the tagged buyer removes themselves. The listing stays
-- sold; it simply has no buyer on Yahora any more.
create or replace function public.remove_my_purchase(
  p_product_id uuid,
  p_buyer_id   uuid
)
  returns void
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  delete from public.purchases
   where product_id = p_product_id
     and buyer_id   = p_buyer_id;

  if not found then
    raise exception 'PURCHASE_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$function$;

-- The people who messaged the seller about this listing, newest conversation
-- first. Only the seller may ask. Only people on the listing's campus are
-- returned, because only they can be its buyer.
create or replace function public.get_product_buyer_candidates(
  p_product_id uuid,
  p_seller_id  uuid
)
  returns table (
    id                uuid,
    username          text,
    full_name         text,
    avatar_url        text,
    last_message_time timestamptz
  )
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_seller uuid;
  v_uni    uuid;
begin
  select p.seller_id, p.university_id into v_seller, v_uni
    from public.products p where p.id = p_product_id;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_seller is distinct from p_seller_id then
    raise exception 'NOT_PRODUCT_OWNER' using errcode = 'P0001';
  end if;

  return query
  select u.id,
         u.username,
         u.full_name::text,          -- varchar(255) -> text, or RETURNS TABLE fails (Phase 5 lesson)
         u.avatar_url,
         max(m.created_at) as last_message_time
    from public.messages m
    join public.users u
      on u.id = case when m.sender_id = p_seller_id then m.receiver_id else m.sender_id end
   where m.product_id = p_product_id
     and (m.sender_id = p_seller_id or m.receiver_id = p_seller_id)
     and u.id <> p_seller_id
     and u.university_id = v_uni
   group by u.id, u.username, u.full_name, u.avatar_url
   order by max(m.created_at) desc
   limit 20;
end;
$function$;

revoke execute on function public.mark_product_sold(uuid, uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.mark_product_available(uuid, uuid)           from public, anon, authenticated;
revoke execute on function public.remove_my_purchase(uuid, uuid)               from public, anon, authenticated;
revoke execute on function public.get_product_buyer_candidates(uuid, uuid)     from public, anon, authenticated;

grant  execute on function public.mark_product_sold(uuid, uuid, uuid)          to service_role;
grant  execute on function public.mark_product_available(uuid, uuid)           to service_role;
grant  execute on function public.remove_my_purchase(uuid, uuid)               to service_role;
grant  execute on function public.get_product_buyer_candidates(uuid, uuid)     to service_role;

commit;
