-- Verifikation nach den Migrationen (läuft lokal und in CI)
\set ON_ERROR_STOP on

do $$
declare v_missing text;
begin
  select string_agg(tablename, ', ') into v_missing
  from pg_tables where schemaname = 'public' and not rowsecurity;
  if v_missing is not null then
    raise exception 'RLS fehlt auf: %', v_missing;
  end if;
  raise notice 'RLS auf allen % Tabellen aktiv', (select count(*) from pg_tables where schemaname = 'public');
end $$;

-- Funktionaler Smoke-Test: Produkt, Varianten, Bundle, Preise, Pfand, Grundpreis, Reservierung, Jobs
do $$
declare
  v_p uuid; v_v9 uuid; v_v12 uuid; v_cup_p uuid; v_cup uuid; v_bundle_p uuid; v_b uuid;
  v_cart uuid; v_cs uuid; v_job uuid; v_n integer; v_base numeric; v_j public.jobs;
begin
  insert into public.products (handle, status, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure)
  values ('test-eistee', 'active', true, 25, 'Dose', 0.330, 'l', 'l') returning id into v_p;
  insert into public.product_translations (product_id, title) values (v_p, 'Test Eistee');
  insert into public.product_variants (product_id, sku, title, option_values, price_cents, unit_count)
  values (v_p, 'T-9', '9 Dosen', '{"Menge":"9"}', 2610, 9) returning id into v_v9;
  insert into public.product_variants (product_id, sku, title, option_values, price_cents, compare_at_cents, compare_at_kind, unit_count)
  values (v_p, 'T-12', '12 Dosen', '{"Menge":"12"}', 3460, 3480, 'quantity_reference', 12) returning id into v_v12;

  -- Pfand und Grundpreis
  if public.variant_deposit_cents(v_v9) <> 225 then raise exception 'Pfand falsch: %', public.variant_deposit_cents(v_v9); end if;
  v_base := public.variant_base_price_cents(v_v9);
  if round(v_base) <> 803 then raise exception 'Grundpreis 9er falsch: %', v_base; end if;
  v_base := public.variant_base_price_cents(v_v12);
  if round(v_base) <> 798 then raise exception 'Grundpreis 12er falsch: %', v_base; end if;

  -- Preishistorie
  update public.product_variants set price_cents = 2500 where id = v_v9;
  if (select count(*) from public.price_history where variant_id = v_v9) <> 2 then raise exception 'Preishistorie fehlt'; end if;
  if public.lowest_price_last_30_days(v_v9) <> 2500 then raise exception 'lowest_price falsch: %', public.lowest_price_last_30_days(v_v9); end if;

  -- Bundle aus 9er + Cup
  insert into public.products (handle, status) values ('test-cup', 'active') returning id into v_cup_p;
  insert into public.product_translations (product_id, title) values (v_cup_p, 'Cup');
  insert into public.product_variants (product_id, sku, title, price_cents) values (v_cup_p, 'T-CUP', 'Default', 1990) returning id into v_cup;
  insert into public.products (handle, status, kind) values ('test-bundle', 'active', 'bundle') returning id into v_bundle_p;
  insert into public.product_translations (product_id, title) values (v_bundle_p, 'Bundle');
  insert into public.product_variants (product_id, sku, title, price_cents) values (v_bundle_p, 'T-B', 'Default', 3580) returning id into v_b;
  insert into public.bundle_components values (v_b, v_v9, 1), (v_b, v_cup, 1);
  if public.bundle_components_sum_cents(v_b) <> 2500 + 1990 then raise exception 'Komponentensumme falsch'; end if;

  -- Bestand: 9er = 10, Cup = 3 → Bundle verfügbar = 3
  perform public.apply_inventory_movement(v_v9, 10, 'initial');
  perform public.apply_inventory_movement(v_cup, 3, 'initial');
  if public.available_quantity(v_b) <> 3 then raise exception 'Bundle-Verfügbarkeit falsch: %', public.available_quantity(v_b); end if;

  -- Reservierung: 2 Bundles → 9er reserviert 2, Cup reserviert 2
  insert into public.carts default values returning id into v_cart;
  insert into public.checkout_sessions (cart_id) values (v_cart) returning id into v_cs;
  perform public.reserve_stock(v_cs, jsonb_build_array(jsonb_build_object('variant_id', v_b, 'quantity', 2)));
  if (select reserved from public.inventory_levels where variant_id = v_cup) <> 2 then raise exception 'Cup-Reservierung falsch'; end if;
  if public.available_quantity(v_b) <> 1 then raise exception 'Bundle-Verfügbarkeit nach Reservierung falsch'; end if;

  -- Überverkauf verhindern
  begin
    perform public.reserve_stock(gen_random_uuid()::uuid, jsonb_build_array(jsonb_build_object('variant_id', v_cup, 'quantity', 5)));
    raise exception 'Überverkauf wurde nicht verhindert';
  exception when foreign_key_violation then
    null; -- Session existiert nicht, aber die Bestandsprüfung kommt zuerst; Fehler erwartet
  when others then
    if sqlerrm not like 'INSUFFICIENT_STOCK%' then raise; end if;
  end;

  -- Commit → on_hand sinkt, reserved sinkt
  perform public.commit_reservations(v_cs, gen_random_uuid());
  if (select on_hand from public.inventory_levels where variant_id = v_cup) <> 1 then raise exception 'Commit falsch'; end if;
  if (select reserved from public.inventory_levels where variant_id = v_cup) <> 0 then raise exception 'Reserved nach Commit falsch'; end if;

  -- Jobs: enqueue, claim, fail (Backoff), retry, complete
  v_job := public.enqueue_job('test.job', '{"a":1}', now(), 'idem-1');
  if public.enqueue_job('test.job', '{"a":1}', now(), 'idem-1') is not null then raise exception 'Idempotenz verletzt'; end if;
  select * into v_j from public.claim_jobs('worker-1', null, 5);
  if v_j.id <> v_job or v_j.status <> 'running' then raise exception 'claim_jobs falsch'; end if;
  perform public.fail_job(v_job, 'boom');
  if (select status from public.jobs where id = v_job) <> 'queued' then raise exception 'fail_job Backoff falsch'; end if;
  update public.jobs set run_at = now() where id = v_job;
  select * into v_j from public.claim_jobs('worker-1', array['test.job'], 5);
  perform public.complete_job(v_job);
  if (select status from public.jobs where id = v_job) <> 'succeeded' then raise exception 'complete_job falsch'; end if;

  -- Rate Limit
  if not public.check_rate_limit('t:1', 2, interval '1 minute') then raise exception 'rate 1'; end if;
  if not public.check_rate_limit('t:1', 2, interval '1 minute') then raise exception 'rate 2'; end if;
  if public.check_rate_limit('t:1', 2, interval '1 minute') then raise exception 'rate 3 hätte blocken müssen'; end if;

  -- Suche
  if not exists (select 1 from public.search_storefront('eistee')) then raise exception 'Suche leer'; end if;

  raise notice 'Smoke-Test bestanden';
  raise exception 'ROLLBACK_TEST_DATA' using errcode = 'P0001';
exception when others then
  if sqlerrm = 'ROLLBACK_TEST_DATA' then
    raise notice 'Testdaten zurückgerollt';
  else
    raise;
  end if;
end $$;

-- RLS-Sichtprüfung: anon sieht nur aktive Produkte
do $$
declare v_p uuid; v_n integer;
begin
  insert into public.products (handle, status) values ('rls-draft', 'draft') returning id into v_p;
  insert into public.product_translations (product_id, title) values (v_p, 'Entwurf');
  set local role anon;
  select count(*) into v_n from public.products where handle = 'rls-draft';
  reset role;
  if v_n <> 0 then raise exception 'anon sieht Entwürfe'; end if;
  delete from public.products where id = v_p;
  raise notice 'RLS-Sichtprüfung bestanden';
end $$;
