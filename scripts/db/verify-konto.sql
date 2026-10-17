-- Prüfungen für das Paket Konto (Migration 20261017103000_konto_auth.sql), nur lokal.
-- Aufruf nach `bash scripts/db/local-pg.sh migrate`:
--   PGHOST=localhost PGPORT=54329 PGUSER=postgres PGDATABASE=provibe \
--   PGOPTIONS="-c search_path=public,extensions" psql -v ON_ERROR_STOP=1 -q -f scripts/db/verify-konto.sql
-- Läuft in einer Transaktion und rollt am Ende zurück.
\set ON_ERROR_STOP on

begin;

-- Die lokalen Stubs kennen email_confirmed_at nicht; Supabase hat die Spalte.
alter table auth.users add column if not exists email_confirmed_at timestamptz;

do $$
declare
  v_shop uuid; v_user uuid; v_other_user uuid; v_other_cust uuid;
  v_order uuid; v_foreign_order uuid; v_guest uuid; v_guest_order uuid;
  v_p uuid; v_v uuid; v_v2 uuid; v_cart_a uuid; v_cart_b uuid;
  v_n integer; v_cust public.customers%rowtype;
begin
  -- Bestandskunde aus Shopify, Gastbestellung, fremde Bestellung
  insert into public.customers (email, first_name, shopify_customer_id)
  values ('bestand@test.local', 'Paula', 4711) returning id into v_shop;
  insert into public.orders (email, shipping_address, payment_status, status, total_cents)
  values ('Bestand@test.local', '{}'::jsonb, 'paid', 'paid', 6190) returning id into v_order;
  insert into public.customers (email) values ('fremd@test.local') returning id into v_other_cust;
  insert into public.orders (email, shipping_address, customer_id) values ('fremd@test.local', '{}'::jsonb, v_other_cust)
  returning id into v_foreign_order;

  -- 1. Unbestätigter Auth-Benutzer: keine Verknüpfung mit dem Bestandskunden
  insert into auth.users (email) values ('bestand@test.local') returning id into v_user;
  if (select auth_user_id from public.customers where id = v_shop) is not null then
    raise exception 'Unbestätigte E-Mail darf nicht verknüpfen';
  end if;
  if (select customer_id from public.orders where id = v_order) is not null then
    raise exception 'Unbestätigte E-Mail darf keine Bestellungen übernehmen';
  end if;

  -- 2. Bestätigung: Verknüpfung und Übernahme der Gastbestellung
  update auth.users set email_confirmed_at = now() where id = v_user;
  if (select auth_user_id from public.customers where id = v_shop) is distinct from v_user then
    raise exception 'Bestätigte E-Mail wurde nicht verknüpft';
  end if;
  if (select customer_id from public.orders where id = v_order) is distinct from v_shop then
    raise exception 'Gastbestellung wurde nicht zugeordnet';
  end if;
  if (select orders_count from public.customers where id = v_shop) <> 1 then
    raise exception 'Kundenkennzahlen nicht aktualisiert';
  end if;
  if public.claim_guest_orders_for(v_shop) <> 0 then
    raise exception 'claim_guest_orders_for ist nicht idempotent';
  end if;

  -- 3. Neuer, direkt bestätigter Benutzer: Kunde wird angelegt
  insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
  values ('neu@test.local', now(), '{"first_name":"Nina"}') returning id into v_other_user;
  if not exists (select 1 from public.customers where auth_user_id = v_other_user and first_name = 'Nina') then
    raise exception 'Neuer Kunde nicht angelegt';
  end if;

  -- 4. E-Mail-Wechsel auf die Adresse eines Gastkunden: zusammenführen
  insert into public.customers (email) values ('gast@test.local') returning id into v_guest;
  insert into public.orders (email, shipping_address, customer_id) values ('gast@test.local', '{}'::jsonb, v_guest)
  returning id into v_guest_order;
  update auth.users set email = 'gast@test.local' where id = v_other_user;
  select * into v_cust from public.customers where auth_user_id = v_other_user;
  if v_cust.email <> 'gast@test.local' then raise exception 'E-Mail nicht übernommen: %', v_cust.email; end if;
  if (select customer_id from public.orders where id = v_guest_order) is distinct from v_cust.id then
    raise exception 'Bestellung des Gastkunden nicht umgehängt';
  end if;
  if (select anonymized_at from public.customers where id = v_guest) is null then
    raise exception 'Gastkunde nicht pseudonymisiert';
  end if;
  if not exists (select 1 from public.customer_events where customer_id = v_cust.id and kind = 'email_changed') then
    raise exception 'Ereignis email_changed fehlt';
  end if;

  -- 5. Warenkörbe zusammenführen
  insert into public.products (handle, status) values ('konto-test', 'active') returning id into v_p;
  insert into public.product_variants (product_id, sku, title, option_values, price_cents) values (v_p, 'KT-1', 'A', '{"M":"1"}', 100) returning id into v_v;
  insert into public.product_variants (product_id, sku, title, option_values, price_cents) values (v_p, 'KT-2', 'B', '{"M":"2"}', 100) returning id into v_v2;
  insert into public.carts (customer_id) values (v_shop) returning id into v_cart_a;
  insert into public.carts default values returning id into v_cart_b;
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart_a, v_v, 40), (v_cart_a, v_v2, 1);
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart_b, v_v, 20);
  v_n := public.merge_cart_into(v_cart_a, v_cart_b);
  if v_n <> 2 then raise exception 'merge_cart_into: % statt 2 Positionen', v_n; end if;
  if (select quantity from public.cart_items where cart_id = v_cart_b and variant_id = v_v) <> 48 then
    raise exception 'Menge nicht auf 48 begrenzt';
  end if;
  if (select status from public.carts where id = v_cart_a) <> 'merged' then raise exception 'Alter Warenkorb nicht merged'; end if;

  -- Für die RLS-Prüfungen unten merken
  perform set_config('konto.user', v_user::text, true);
  perform set_config('konto.shop', v_shop::text, true);
  perform set_config('konto.other_cust', v_other_cust::text, true);
  perform set_config('konto.order', v_order::text, true);
  perform set_config('konto.foreign_order', v_foreign_order::text, true);
  raise notice 'Konto: Verknüpfung, Gastbestellungen, E-Mail-Wechsel und Warenkorb ok';
end $$;

-- 6. RLS als eingeloggter Kunde ---------------------------------------------------------
do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('konto.user'), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;
set local role authenticated;

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.orders;
  if v_n <> 1 then raise exception 'Kunde sieht % Bestellungen statt 1', v_n; end if;
  if exists (select 1 from public.orders where id = current_setting('konto.foreign_order')::uuid) then
    raise exception 'Fremde Bestellung sichtbar';
  end if;
  select count(*) into v_n from public.customers;
  if v_n <> 1 then raise exception 'Kunde sieht % Kundendatensätze', v_n; end if;

  -- Profil: Name ja, B2B-Status nein
  update public.customers set first_name = 'Paulina' where id = current_setting('konto.shop')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Namensänderung nicht möglich'; end if;
  begin
    update public.customers set b2b_status = 'approved' where id = current_setting('konto.shop')::uuid;
    raise exception 'b2b_status durfte geändert werden';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.customers set email = 'x@test.local' where id = current_setting('konto.shop')::uuid;
    raise exception 'email durfte direkt geändert werden';
  exception when insufficient_privilege then null;
  end;

  -- Adressen: eigene ja, fremde nein
  insert into public.customer_addresses (customer_id, first_name, last_name, street, postal_code, city)
  values (current_setting('konto.shop')::uuid, 'P', 'M', 'Musterstraße 12', '10115', 'Berlin');
  begin
    insert into public.customer_addresses (customer_id, first_name, last_name, street, postal_code, city)
    values (current_setting('konto.other_cust')::uuid, 'X', 'Y', 'Z', '1', 'B');
    raise exception 'Fremde Adresse durfte angelegt werden';
  exception when insufficient_privilege then null;
  end;

  -- Bestellungen nur lesen
  update public.orders set total_cents = 1 where id = current_setting('konto.order')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'Kunde durfte Bestellung ändern'; end if;

  -- Interne Funktionen gesperrt
  begin
    perform public.claim_guest_orders_for(current_setting('konto.shop')::uuid);
    raise exception 'claim_guest_orders_for für authenticated aufrufbar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.anonymize_customer(current_setting('konto.shop')::uuid);
    raise exception 'anonymize_customer für authenticated aufrufbar';
  exception when insufficient_privilege then null;
  end;
  raise notice 'Konto: RLS für Kunden ok';
end $$;

reset role;

-- 7. Konto löschen ----------------------------------------------------------------------
do $$
declare v_cust public.customers%rowtype;
begin
  delete from auth.users where id = current_setting('konto.user')::uuid;
  perform public.anonymize_customer(current_setting('konto.shop')::uuid);
  select * into v_cust from public.customers where id = current_setting('konto.shop')::uuid;
  if v_cust.anonymized_at is null or v_cust.first_name is not null or v_cust.email not like 'geloescht+%' then
    raise exception 'Kunde nicht pseudonymisiert';
  end if;
  if exists (select 1 from public.customer_addresses where customer_id = v_cust.id) then
    raise exception 'Adressen nicht gelöscht';
  end if;
  if (select customer_id from public.orders where id = current_setting('konto.order')::uuid) is distinct from v_cust.id then
    raise exception 'Bestellung muss erhalten bleiben';
  end if;
  raise notice 'Konto: Löschung und Pseudonymisierung ok';
end $$;

rollback;
