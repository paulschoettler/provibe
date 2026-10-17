-- Lagereinheit Dose (Entscheidung H14/H24, ADR-018), 17.10.2026.
--
-- Bestand wird ausschließlich in Dosen geführt (plus Merch mit eigenem Bestand):
-- 1. Je Sorte (Wildberry, Raspberry Lime, Peach) gibt es genau eine inaktive Einzeldosen-Variante
--    (unit_count 1, is_active false) als Lagereinheit. Der Seed hat sie als "1 Dose
--    (Bundle-Komponente)" mit den SKUs PV-WB-01, PV-RL-01, PV-PE-01 schon angelegt (die Founder
--    Bundles zeigen bereits darauf); fehlt eine, wird sie angelegt. Idempotent über die SKU.
-- 2. Jede Packvariante (9 bis 48 Dosen) der Sorten und von Mixed besteht über bundle_components
--    aus unit_count Dosen (Mixed: unit_count / 3 je Sorte). Die Produkte bleiben kind = 'simple',
--    damit Katalog, Warenkorb und Preisanzeige (Streichpreis "Einzeln") unverändert bleiben.
-- 3. Neue Hilfsfunktionen stock_units (Lagereinheiten einer Variante, rekursiv über
--    bundle_components, Bundle > Pack > Dose) und stock_unit_available (Bestand einer
--    Lagereinheit). available_quantity und reserve_stock lösen jetzt jede Variante mit
--    Komponenten auf (nicht mehr nur kind = 'bundle'). commit_reservations, release_reservations
--    und expire_reservations arbeiten auf den Reservierungszeilen und buchen damit automatisch in
--    Dosen ab beziehungsweise frei; sie bleiben unverändert.
-- 4. "Unbegrenzt bis zum Import" (Migration 20260921160000, Antwort C5) bleibt erhalten: eine
--    Lagereinheit ohne Bestandsführung liefert 999999. Ein Pack oder Bundle, dessen Lagereinheiten
--    alle unbegrenzt sind, liefert ebenfalls 999999 (vorher 999999 / Menge). Neue Bestandszeilen
--    für Dosen übernehmen den Schalter des Shops (aus, solange keine Zeile geführt wird).
-- 5. Packbestände ungleich 0 werden in Dosen umgerechnet und auf die Einzeldosen gebucht
--    (inventory_movements, Grund correction, Notiz "H24 Umstellung"). Bis zum Import sind alle 0.
-- 6. admin_adjust_inventory lehnt Buchungen auf Packs ab (PACK_STOCK_DERIVED),
--    admin_inventory_overview liefert zusätzlich stock_role und components.
-- 7. Warnschwelle der Einzeldosen: 48 Dosen, wenn noch der Standard 10 eingetragen ist (Annahme,
--    ADR-018; im Backoffice änderbar).
--
-- Bestandszahlen werden nicht verändert (außer der Umrechnung in 5).
--
-- Rückweg (in einer Transaktion, nur vor dem Import echter Bestände ohne Nacharbeit):
--   a) Funktionen zurück: aus 20260921120300_inventory.sql nur die beiden Blöcke
--      "create or replace function public.available_quantity" und "... public.reserve_stock"
--      ausführen (die Datei als Ganzes legt Typen an und bricht ab); danach
--      drop function public.admin_inventory_overview(); (Rückgabetyp geändert) und
--      20261017203000_admin_catalog_inventory.sql vollständig erneut ausführen.
--   b) drop function if exists public.stock_units(uuid);
--      drop function if exists public.stock_unit_available(uuid);
--   c) Pack-Komponenten entfernen (nur Packs der vier Eistee-Produkte, nicht die Founder Bundles):
--      delete from public.bundle_components c using public.product_variants v, public.products p
--       where c.bundle_variant_id = v.id and v.product_id = p.id and p.kind = 'simple'
--         and p.handle in ('wildberry', 'raspberry-lime', 'peach', 'provibe-eistee-mixed');
--   d) Umbuchungen aus 5 (falls es welche gab) mit Gegenbuchungen umkehren:
--      select public.apply_inventory_movement(m.variant_id, -m.delta, 'correction', 'migration',
--             '20261017211000', 'H24 Rückweg', null)
--        from public.inventory_movements m
--       where m.reference_type = 'migration' and m.reference_id = '20261017211000'
--         and m.note not like 'H24 Rückweg%';
--   Die Einzeldosen-Varianten bleiben stehen (die Founder Bundles brauchen sie weiterhin).

-- ------------------------------------------------------------------------------------------
-- Hilfsfunktionen
-- ------------------------------------------------------------------------------------------

-- Lagereinheiten einer Variante mit Menge je 1 Stück der Variante. Eine Variante ohne Komponenten
-- ist ihre eigene Lagereinheit. Rekursiv (Bundle > Pack > Dose), Tiefe begrenzt gegen Zyklen.
create or replace function public.stock_units(p_variant_id uuid)
returns table (variant_id uuid, quantity integer)
language sql stable security definer set search_path = public, extensions as $$
  with recursive tree (variant_id, quantity, depth) as (
    select p_variant_id, 1, 0
    union all
    select c.component_variant_id, t.quantity * c.quantity, t.depth + 1
    from tree t
    join public.bundle_components c on c.bundle_variant_id = t.variant_id
    where t.depth < 4
  )
  select t.variant_id, sum(t.quantity)::integer
  from tree t
  where not exists (select 1 from public.bundle_components c where c.bundle_variant_id = t.variant_id)
  group by t.variant_id;
$$;

-- Verfügbar einer Lagereinheit: on_hand - reserved, 999999 ohne Zeile, ohne Bestandsführung oder
-- mit Nachbestellung (unverändert gegenüber available_quantity aus 0004).
create or replace function public.stock_unit_available(p_variant_id uuid)
returns integer
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_level public.inventory_levels%rowtype;
begin
  select * into v_level from public.inventory_levels where variant_id = p_variant_id;
  if not found or not v_level.track_inventory or v_level.allow_backorder then
    return 999999;
  end if;
  return greatest(v_level.on_hand - v_level.reserved, 0);
end $$;

-- Verfügbare Menge: Lagereinheit = Bestand; Pack oder Bundle = Minimum über die Lagereinheiten
-- von floor(verfügbar / Menge); sind alle Lagereinheiten unbegrenzt, ist es das Pack auch.
create or replace function public.available_quantity(p_variant_id uuid)
returns integer
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_kind public.product_kind;
  v_min integer;
  v_units integer;
begin
  select p.kind into v_kind
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  if v_kind is null then return 0; end if;

  if exists (select 1 from public.bundle_components c where c.bundle_variant_id = p_variant_id) then
    select min(s.avail / s.quantity) filter (where s.avail < 999999), count(*)
      into v_min, v_units
    from (
      select u.quantity, public.stock_unit_available(u.variant_id) as avail
      from public.stock_units(p_variant_id) u
    ) s;
    if v_units = 0 then return 0; end if;
    return coalesce(v_min, 999999);
  end if;

  -- Bundle ohne Komponenten ist nicht verkaufbar (wie bisher)
  if v_kind = 'bundle' then return 0; end if;
  return public.stock_unit_available(p_variant_id);
end $$;

-- Reservierung für eine Checkout-Session. items: [{"variant_id":"...","quantity":2}]
-- Packs und Bundles werden auf ihre Lagereinheiten (Dosen, Merch) aufgelöst; reserviert wird je
-- Lagereinheit, bundle_variant_id hält fest, über welche gekaufte Variante. Wirft bei zu wenig
-- Bestand INSUFFICIENT_STOCK mit Details (variant_id der Lagereinheit, Mengen in Lagereinheiten,
-- via_variant_id der gekauften Variante).
create or replace function public.reserve_stock(p_checkout_session_id uuid, p_items jsonb, p_ttl interval default interval '20 minutes')
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_avail integer;
begin
  -- bestehende Reservierungen dieser Session freigeben (idempotent bei Wiederholung)
  perform public.release_reservations(p_checkout_session_id);

  for r in
    with req as (
      select (i->>'variant_id')::uuid as variant_id, sum((i->>'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) i
      group by 1
    ), expanded as (
      select u.variant_id,
             case when u.variant_id <> req.variant_id then req.variant_id end as bundle_variant_id,
             req.quantity * u.quantity as quantity
      from req
      cross join lateral public.stock_units(req.variant_id) u
    )
    select variant_id, bundle_variant_id, sum(quantity)::integer as quantity
    from expanded
    group by variant_id, bundle_variant_id
    order by variant_id, bundle_variant_id nulls first -- feste Sperrreihenfolge gegen Deadlocks
  loop
    insert into public.inventory_levels (variant_id) values (r.variant_id) on conflict do nothing;
    perform 1 from public.inventory_levels where variant_id = r.variant_id for update;
    v_avail := public.available_quantity(r.variant_id);
    if v_avail < r.quantity then
      raise exception 'INSUFFICIENT_STOCK' using detail = json_build_object(
        'variant_id', r.variant_id, 'requested', r.quantity, 'available', v_avail,
        'via_variant_id', r.bundle_variant_id)::text;
    end if;
    update public.inventory_levels set reserved = reserved + r.quantity, updated_at = now()
    where variant_id = r.variant_id and track_inventory;
    insert into public.inventory_reservations (checkout_session_id, variant_id, bundle_variant_id, quantity, expires_at)
    values (p_checkout_session_id, r.variant_id, r.bundle_variant_id, r.quantity, now() + p_ttl);
  end loop;
end $$;

revoke all on function public.stock_units(uuid) from public, anon, authenticated;
revoke all on function public.stock_unit_available(uuid) from public, anon, authenticated;
grant execute on function public.stock_units(uuid) to service_role;
grant execute on function public.stock_unit_available(uuid) to service_role;
revoke execute on function public.reserve_stock(uuid, jsonb, interval) from public, anon, authenticated;
-- In Supabase erhält service_role das Recht über Default Privileges; hier ausdrücklich, damit
-- Checkout und Abo-Lauf (Service-Role) auch auf einer Instanz ohne diese Defaults reservieren.
grant execute on function public.reserve_stock(uuid, jsonb, interval) to service_role;
grant execute on function public.available_quantity(uuid) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------------------
-- Daten: Einzeldosen, Pack-Komponenten, Umrechnung alter Packbestände
-- ------------------------------------------------------------------------------------------

do $$
declare
  f record;
  v record;
  v_product uuid;
  v_can uuid;
  v_cans uuid[] := '{}';
  v_mixed uuid;
  v_track boolean;
  v_foreign integer;
begin
  -- Bestandsführung des Shops: aus, solange keine Zeile geführt wird (C5/H3)
  select exists (select 1 from public.inventory_levels where track_inventory) into v_track;

  for f in
    select * from (values
      (1, 'wildberry', 'PV-WB-01'),
      (2, 'raspberry-lime', 'PV-RL-01'),
      (3, 'peach', 'PV-PE-01')
    ) as t(ord, handle, sku)
    order by ord
  loop
    select id into v_product from public.products where handle = f.handle;
    if v_product is null then
      raise exception 'H24: Produkt % fehlt', f.handle;
    end if;

    -- Einzeldose finden (SKU, sonst Menge 1 am Produkt) oder anlegen
    select id into v_can from public.product_variants where sku = f.sku;
    if v_can is null then
      select id into v_can from public.product_variants
      where product_id = v_product and unit_count = 1 and option_values = '{"Menge":"1"}'::jsonb;
    end if;
    if v_can is null then
      insert into public.product_variants
        (product_id, sku, title, option_values, position, price_cents, compare_at_kind,
         unit_count, weight_grams, packaging_weight_grams, is_active)
      values
        (v_product, f.sku, '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none',
         1, 360, 0, false)
      returning id into v_can;
    end if;
    if (select product_id from public.product_variants where id = v_can) <> v_product then
      raise exception 'H24: SKU % gehört nicht zu %', f.sku, f.handle;
    end if;
    update public.product_variants
       set is_active = false, unit_count = 1, sku = coalesce(sku, f.sku)
     where id = v_can and (is_active or unit_count <> 1 or sku is null);

    insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder)
    values (v_can, 0, v_track, false)
    on conflict (variant_id) do nothing;
    -- Warnschwelle in Dosen (Annahme ADR-018), nur wenn noch der Standard steht
    update public.inventory_levels set low_stock_threshold = 48, updated_at = now()
     where variant_id = v_can and low_stock_threshold = 10;

    v_cans := v_cans || v_can;

    -- Packs der Sorte: unit_count Dosen
    for v in
      select pv.id, pv.unit_count from public.product_variants pv
      where pv.product_id = v_product and pv.id <> v_can
    loop
      select count(*) into v_foreign from public.bundle_components
       where bundle_variant_id = v.id and component_variant_id <> v_can;
      if v_foreign > 0 then
        raise exception 'H24: Pack % hat fremde Komponenten, bitte prüfen', v.id;
      end if;
      insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity)
      values (v.id, v_can, v.unit_count)
      on conflict (bundle_variant_id, component_variant_id) do update set quantity = excluded.quantity;
    end loop;
  end loop;

  -- Mixed: je ein Drittel je Sorte
  select id into v_mixed from public.products where handle = 'provibe-eistee-mixed';
  if v_mixed is null then
    raise notice 'H24: Produkt provibe-eistee-mixed fehlt, Mixed übersprungen';
  else
    for v in select pv.id, pv.unit_count from public.product_variants pv where pv.product_id = v_mixed
    loop
      if v.unit_count % 3 <> 0 then
        raise exception 'H24: Mixed-Variante % hat % Dosen, nicht durch 3 teilbar', v.id, v.unit_count;
      end if;
      select count(*) into v_foreign from public.bundle_components
       where bundle_variant_id = v.id and not (component_variant_id = any (v_cans));
      if v_foreign > 0 then
        raise exception 'H24: Mixed-Variante % hat fremde Komponenten, bitte prüfen', v.id;
      end if;
      insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity)
      select v.id, c, v.unit_count / 3 from unnest(v_cans) as c
      on conflict (bundle_variant_id, component_variant_id) do update set quantity = excluded.quantity;
    end loop;
  end if;

  -- Alte Packbestände (nur einfache Produkte mit Komponenten) in Dosen umbuchen
  for v in
    select l.variant_id, l.on_hand, pv.sku
    from public.inventory_levels l
    join public.product_variants pv on pv.id = l.variant_id
    join public.products p on p.id = pv.product_id
    where p.kind = 'simple' and l.on_hand <> 0
      and exists (select 1 from public.bundle_components c where c.bundle_variant_id = l.variant_id)
  loop
    perform public.apply_inventory_movement(c.component_variant_id, v.on_hand * c.quantity,
              'correction', 'migration', '20261017211000',
              'H24 Umstellung: aus ' || coalesce(v.sku, v.variant_id::text), null)
    from public.bundle_components c where c.bundle_variant_id = v.variant_id;
    perform public.apply_inventory_movement(v.variant_id, -v.on_hand,
              'correction', 'migration', '20261017211000',
              'H24 Umstellung: in Dosen umgerechnet', null);
  end loop;
end $$;

-- ------------------------------------------------------------------------------------------
-- Backoffice: Buchung nur auf Lagereinheiten, Übersicht mit Rolle und Komponenten
-- ------------------------------------------------------------------------------------------

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
  if exists (select 1 from public.bundle_components c where c.bundle_variant_id = p_variant_id) then
    raise exception 'PACK_STOCK_DERIVED';
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

-- Rückgabetyp ändert sich (stock_role, components), deshalb drop + create
drop function if exists public.admin_inventory_overview();
create function public.admin_inventory_overview()
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
  updated_at timestamptz,
  -- 'unit' = Lagereinheit (Dose, Merch), 'pack' = Pack aus Lagereinheiten, 'bundle' = Bundle
  stock_role text,
  -- Lagereinheiten je Stück: [{"variant_id","sku","product_title","variant_title","quantity"}]
  components jsonb)
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
         l.updated_at,
         case
           when p.kind = 'bundle' then 'bundle'
           when exists (select 1 from public.bundle_components c where c.bundle_variant_id = v.id) then 'pack'
           else 'unit'
         end,
         case
           when exists (select 1 from public.bundle_components c where c.bundle_variant_id = v.id) then (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'variant_id', u.variant_id,
                      'sku', uv.sku,
                      'product_title', coalesce(ut.title, up.handle),
                      'variant_title', uv.title,
                      'quantity', u.quantity) order by up.position desc, up.handle), '[]'::jsonb)
             from public.stock_units(v.id) u
             join public.product_variants uv on uv.id = u.variant_id
             join public.products up on up.id = uv.product_id
             left join public.product_translations ut on ut.product_id = up.id and ut.locale = 'de')
           else '[]'::jsonb
         end
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
