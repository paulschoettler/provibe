-- 0004 Bestand, Bewegungen, Reservierungen (keine Überverkäufe)

create type public.inventory_reason as enum
  ('initial', 'purchase', 'sale', 'refund_restock', 'correction', 'damaged', 'import', 'reservation_commit');
create type public.reservation_status as enum ('active', 'committed', 'released', 'expired');

create table public.inventory_levels (
  variant_id          uuid primary key references public.product_variants (id) on delete cascade,
  on_hand             integer not null default 0,
  reserved            integer not null default 0 check (reserved >= 0),
  low_stock_threshold integer not null default 10,
  track_inventory     boolean not null default true,
  allow_backorder     boolean not null default false,
  updated_at          timestamptz not null default now()
);

create table public.inventory_movements (
  id             bigint generated always as identity primary key,
  variant_id     uuid not null references public.product_variants (id) on delete cascade,
  delta          integer not null,
  reason         public.inventory_reason not null,
  reference_type text,
  reference_id   text,
  note           text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create table public.inventory_reservations (
  id                  uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null,
  variant_id          uuid not null references public.product_variants (id) on delete cascade,
  bundle_variant_id   uuid references public.product_variants (id) on delete set null,
  quantity            integer not null check (quantity > 0),
  status              public.reservation_status not null default 'active',
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index inventory_reservations_session_idx on public.inventory_reservations (checkout_session_id);
create index inventory_reservations_active_idx on public.inventory_reservations (expires_at) where status = 'active';

create or replace function public.apply_inventory_movement(
  p_variant_id uuid, p_delta integer, p_reason public.inventory_reason,
  p_reference_type text default null, p_reference_id text default null,
  p_note text default null, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory_levels (variant_id) values (p_variant_id)
  on conflict (variant_id) do nothing;
  update public.inventory_levels set on_hand = on_hand + p_delta, updated_at = now()
  where variant_id = p_variant_id;
  insert into public.inventory_movements (variant_id, delta, reason, reference_type, reference_id, note, created_by)
  values (p_variant_id, p_delta, p_reason, p_reference_type, p_reference_id, p_note, coalesce(p_actor, auth.uid()));
end $$;

-- Verfügbare Menge: einfache Variante = on_hand - reserved; Bundle = Minimum über Komponenten
create or replace function public.available_quantity(p_variant_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_kind public.product_kind;
  v_level public.inventory_levels%rowtype;
  v_min integer;
begin
  select p.kind into v_kind from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  if v_kind is null then return 0; end if;

  if v_kind = 'bundle' then
    select min(public.available_quantity(c.component_variant_id) / c.quantity) into v_min
    from public.bundle_components c where c.bundle_variant_id = p_variant_id;
    return coalesce(v_min, 0);
  end if;

  select * into v_level from public.inventory_levels where variant_id = p_variant_id;
  if not found or not v_level.track_inventory or v_level.allow_backorder then
    return 999999;
  end if;
  return greatest(v_level.on_hand - v_level.reserved, 0);
end $$;

-- Reservierung für eine Checkout-Session. items: [{"variant_id":"...","quantity":2}]
-- Bundles werden auf Komponenten aufgelöst. Wirft bei zu wenig Bestand eine Exception mit Details.
create or replace function public.reserve_stock(p_checkout_session_id uuid, p_items jsonb, p_ttl interval default interval '20 minutes')
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_avail integer;
begin
  -- bestehende Reservierungen dieser Session freigeben (idempotent bei Wiederholung)
  perform public.release_reservations(p_checkout_session_id);

  for r in
    with req as (
      select (i->>'variant_id')::uuid as variant_id, (i->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) i
    ), expanded as (
      select coalesce(c.component_variant_id, req.variant_id) as variant_id,
             case when c.component_variant_id is not null then req.variant_id end as bundle_variant_id,
             req.quantity * coalesce(c.quantity, 1) as quantity
      from req
      left join public.bundle_components c on c.bundle_variant_id = req.variant_id
    )
    select variant_id, bundle_variant_id, sum(quantity)::integer as quantity
    from expanded group by variant_id, bundle_variant_id
  loop
    insert into public.inventory_levels (variant_id) values (r.variant_id) on conflict do nothing;
    perform 1 from public.inventory_levels where variant_id = r.variant_id for update;
    v_avail := public.available_quantity(r.variant_id);
    if v_avail < r.quantity then
      raise exception 'INSUFFICIENT_STOCK' using detail = json_build_object(
        'variant_id', r.variant_id, 'requested', r.quantity, 'available', v_avail)::text;
    end if;
    update public.inventory_levels set reserved = reserved + r.quantity, updated_at = now()
    where variant_id = r.variant_id and track_inventory;
    insert into public.inventory_reservations (checkout_session_id, variant_id, bundle_variant_id, quantity, expires_at)
    values (p_checkout_session_id, r.variant_id, r.bundle_variant_id, r.quantity, now() + p_ttl);
  end loop;
end $$;

create or replace function public.release_reservations(p_checkout_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.inventory_reservations
           where checkout_session_id = p_checkout_session_id and status = 'active' for update
  loop
    update public.inventory_levels set reserved = greatest(reserved - r.quantity, 0), updated_at = now()
    where variant_id = r.variant_id;
    update public.inventory_reservations set status = 'released', updated_at = now() where id = r.id;
  end loop;
end $$;

-- Reservierung in echten Abgang wandeln (nach payment_intent.succeeded)
create or replace function public.commit_reservations(p_checkout_session_id uuid, p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.inventory_reservations
           where checkout_session_id = p_checkout_session_id and status = 'active' for update
  loop
    update public.inventory_levels set reserved = greatest(reserved - r.quantity, 0), updated_at = now()
    where variant_id = r.variant_id;
    perform public.apply_inventory_movement(r.variant_id, -r.quantity, 'sale', 'order', p_order_id::text, null, null);
    update public.inventory_reservations set status = 'committed', updated_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public.expire_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select * from public.inventory_reservations
           where status = 'active' and expires_at < now() for update skip locked
  loop
    update public.inventory_levels set reserved = greatest(reserved - r.quantity, 0), updated_at = now()
    where variant_id = r.variant_id;
    update public.inventory_reservations set status = 'expired', updated_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
