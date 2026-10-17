-- Admin-Katalog (Paket Admin-Katalog, 17.10.2026): atomare Bestandskorrektur und Bestandsübersicht
-- für das Backoffice (/admin/bestand, Briefing 8: "Korrekturen mit Grund, Historie, Warnschwellen").
--
-- Vorhanden und unverändert genutzt: inventory_levels.low_stock_threshold, track_inventory,
-- allow_backorder, inventory_movements, Enum inventory_reason (correction = Korrektur,
-- purchase = Wareneingang, damaged = Schwund, refund_restock = Retoure), available_quantity().
--
-- Neu:
-- 1. admin_adjust_inventory: sperrt die Bestandszeile (FOR UPDATE), prüft Grund, Vorzeichen und
--    negativen Bestand, bucht on_hand und schreibt die Bewegung in einer Transaktion. Die Regel
--    "negativer Bestand nur mit Grund Korrektur und Owner/Admin" prüft die Anwendung (Rolle) und
--    hier zusätzlich der Parameter p_allow_negative (nur zusammen mit correction).
-- 2. admin_inventory_overview: alle Varianten mit on_hand, reserviert, verfügbar
--    (available_quantity, Bundles aus Komponenten) und Warnschwelle in einer Abfrage.
--
-- Beide nur für service_role (Backoffice-Server), nicht für anon/authenticated.
-- Idempotent (create or replace). Rückweg:
--   drop function if exists public.admin_adjust_inventory(uuid, integer, public.inventory_reason, text, uuid, boolean);
--   drop function if exists public.admin_inventory_overview();

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_delta integer,
  p_reason public.inventory_reason,
  p_note text default null,
  p_actor uuid default null,
  p_allow_negative boolean default false)
returns table (new_on_hand integer, current_reserved integer, movement_id bigint)
language plpgsql security invoker set search_path = public, extensions as $$
declare
  v_kind public.product_kind;
  v_on_hand integer;
  v_reserved integer;
  v_new integer;
  v_movement bigint;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'INVALID_DELTA' using detail = 'delta must not be 0';
  end if;
  if p_reason not in ('correction', 'purchase', 'damaged', 'refund_restock') then
    raise exception 'INVALID_REASON' using detail = p_reason::text;
  end if;
  if p_reason in ('purchase', 'refund_restock') and p_delta < 0 then
    raise exception 'DELTA_SIGN' using detail = 'purchase/refund_restock need a positive delta';
  end if;
  if p_reason = 'damaged' and p_delta > 0 then
    raise exception 'DELTA_SIGN' using detail = 'damaged needs a negative delta';
  end if;
  if p_allow_negative and p_reason <> 'correction' then
    raise exception 'NEGATIVE_ONLY_CORRECTION';
  end if;

  select p.kind into v_kind
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  if v_kind is null then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if v_kind = 'bundle' then
    raise exception 'BUNDLE_STOCK_DERIVED';
  end if;

  insert into public.inventory_levels (variant_id) values (p_variant_id)
  on conflict (variant_id) do nothing;

  select l.on_hand, l.reserved into v_on_hand, v_reserved
  from public.inventory_levels l where l.variant_id = p_variant_id
  for update;

  v_new := v_on_hand + p_delta;
  if v_new < 0 and not p_allow_negative then
    raise exception 'NEGATIVE_STOCK'
      using detail = json_build_object('on_hand', v_on_hand, 'delta', p_delta)::text;
  end if;

  update public.inventory_levels l set on_hand = v_new, updated_at = now()
  where l.variant_id = p_variant_id;

  insert into public.inventory_movements (variant_id, delta, reason, reference_type, note, created_by)
  values (p_variant_id, p_delta, p_reason, 'admin', nullif(btrim(p_note), ''), p_actor)
  returning id into v_movement;

  return query select v_new, v_reserved, v_movement;
end $$;

create or replace function public.admin_inventory_overview()
returns table (
  variant_id uuid,
  product_id uuid,
  product_handle text,
  product_title text,
  product_status public.product_status,
  product_kind public.product_kind,
  variant_title text,
  sku text,
  unit_count integer,
  variant_active boolean,
  on_hand integer,
  reserved integer,
  available integer,
  low_stock_threshold integer,
  track_inventory boolean,
  allow_backorder boolean,
  updated_at timestamptz)
language sql stable security invoker set search_path = public, extensions as $$
  select v.id,
         p.id,
         p.handle,
         coalesce(t.title, p.handle),
         p.status,
         p.kind,
         v.title,
         v.sku,
         v.unit_count,
         v.is_active,
         coalesce(l.on_hand, 0),
         coalesce(l.reserved, 0),
         public.available_quantity(v.id),
         coalesce(l.low_stock_threshold, 10),
         coalesce(l.track_inventory, false),
         coalesce(l.allow_backorder, false),
         l.updated_at
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_levels l on l.variant_id = v.id
  left join public.product_translations t on t.product_id = p.id and t.locale = 'de'
  order by p.position, p.handle, v.position;
$$;

revoke execute on function public.admin_adjust_inventory(uuid, integer, public.inventory_reason, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_inventory_overview() from public, anon, authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, public.inventory_reason, text, uuid, boolean) to service_role;
grant execute on function public.admin_inventory_overview() to service_role;
