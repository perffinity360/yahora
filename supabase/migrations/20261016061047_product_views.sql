-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 6B · Block V-B · products.views means "how many different students
-- opened this listing"
--
-- Before: two uncoordinated paths added 1 to products.views.
--   (a) The website's ProductCard called increment_product_views() from the
--       browser for every card SHOWN in the feed (an impression, not a view),
--       once per browser tab session.
--   (b) GET /api/products/:id called it on EVERY fetch — including every
--       "load more comments" page and every refetch.
--   And increment_product_views() was callable by anyone holding the public
--   key, for any listing, as often as they liked.
--
-- After: one path. The backend calls record_product_view(product, viewer) when
-- a signed-in person opens the listing's first page. A person counts ONCE per
-- listing, ever. The seller's own views never count. A demo account's views
-- count only on demo listings — demo login is one click for anyone, so it must
-- not be able to inflate a real student's numbers.
--
-- Existing numbers are left alone: they cannot be reconstructed, and the
-- production data is test data that is wiped before launch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table public.product_views (
  product_id      uuid        not null references public.products(id) on delete cascade,
  viewer_id       uuid        not null references public.users(id)    on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (product_id, viewer_id)
);

comment on table public.product_views is
  'One row per (listing, person) who has opened it. Makes products.views a '
  'count of distinct viewers. Backend-only (RLS on, no policies, no grants).';

alter table public.product_views enable row level security;
revoke all on public.product_views from anon, authenticated;
grant select, insert on public.product_views to service_role;

create or replace function public.record_product_view(
  p_product_id uuid,
  p_viewer_id  uuid
)
  returns boolean            -- true = this was the person's first view, counted
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_seller       uuid;
  v_product_demo boolean;
  v_viewer_demo  boolean;
  v_inserted     int;
begin
  select p.seller_id, coalesce(un.is_demo, false)
    into v_seller, v_product_demo
    from public.products p
    left join public.universities un on un.id = p.university_id
   where p.id = p_product_id;

  if not found then
    return false;
  end if;

  -- Your own listing never counts.
  if v_seller = p_viewer_id then
    return false;
  end if;

  select coalesce(un.is_demo, false)
    into v_viewer_demo
    from public.users u
    left join public.universities un on un.id = u.university_id
   where u.id = p_viewer_id;

  if not found then
    return false;
  end if;

  -- Demo views count on demo listings only, and real views on real listings.
  if v_viewer_demo is distinct from v_product_demo then
    return false;
  end if;

  insert into public.product_views (product_id, viewer_id)
  values (p_product_id, p_viewer_id)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;            -- seen before: not counted again
  end if;

  update public.products
     set views = coalesce(views, 0) + 1
   where id = p_product_id;

  return true;
end;
$function$;

revoke execute on function public.record_product_view(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.record_product_view(uuid, uuid) to service_role;

-- Close the old door today. The backend (service_role) keeps its explicit
-- grant, so the live API keeps working until the new code is deployed. The
-- function itself is dropped in Phase 9 housekeeping, once nothing calls it.
revoke execute on function public.increment_product_views(uuid) from public, anon, authenticated;

commit;
