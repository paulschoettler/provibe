-- 1030 Kundenkonto (Paket Konto, docs/konto-und-abo-plan.md Teil A)
--
-- Inhalt:
--   1. Verknüpfung auth.users <-> customers erst nach bestätigter E-Mail (Schutz vor Kontoübernahme
--      über eine fremde, unbestätigte Adresse). Neuer Trigger nach Update von auth.users für
--      Bestätigung und E-Mail-Wechsel.
--   2. claim_guest_orders_for(): ordnet Gastbestellungen mit derselben E-Mail dem Kunden zu.
--   3. guard_customer_self_update(): Kunden dürfen per API nur Name, Telefon und Sprache ändern
--      (die bestehende Policy customer_self_update erlaubte sonst auch b2b_status, price_list_id usw.).
--   4. anonymize_customer(): Konto löschen, Kunde pseudonymisieren, Bestellungen bleiben (AO/HGB).
--   5. merge_cart_into(): Gast-Warenkorb und Kundenwarenkorb zusammenführen.
--
-- RLS: Die Kunden-Policies für customers, customer_addresses, orders, order_items, order_events,
-- shipments, refunds und newsletter_contacts existieren seit 20260921121300_rls.sql. Eine Tabelle
-- invoices gibt es nicht (Rechnungsdaten liegen an orders), deshalb hier keine weiteren Policies.
--
-- Alle Funktionen lesen email_confirmed_at über to_jsonb(), damit die Migration auch gegen die
-- lokalen Stubs (scripts/db/supabase-stubs.sql, ohne diese Spalte) läuft.
--
-- Rückweg (manuell, in dieser Reihenfolge):
--   drop trigger if exists on_auth_user_updated on auth.users;
--   drop function if exists public.handle_auth_user_updated();
--   drop trigger if exists customers_guard_self_update on public.customers;
--   drop function if exists public.guard_customer_self_update();
--   drop function if exists public.merge_cart_into(uuid, uuid);
--   drop function if exists public.anonymize_customer(uuid);
--   drop function if exists public.merge_customer_into(uuid, uuid);
--   drop function if exists public.claim_guest_orders_for(uuid);
--   handle_new_auth_user() aus 20260921120400_customers.sql erneut ausführen, danach
--   drop function if exists public.link_auth_user_to_customer(uuid, text, boolean, jsonb);

-- 1. Gastbestellungen zuordnen ------------------------------------------------
create or replace function public.claim_guest_orders_for(p_customer_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email citext;
  v_count integer := 0;
begin
  -- Nur für verknüpfte Kunden mit bestätigter, identischer Auth-E-Mail
  select c.email into v_email
  from public.customers c
  join auth.users u on u.id = c.auth_user_id
  where c.id = p_customer_id
    and c.anonymized_at is null
    and (to_jsonb(u) ->> 'email_confirmed_at') is not null
    and lower(u.email) = lower(c.email::text);
  if v_email is null then
    return 0;
  end if;

  update public.orders set customer_id = p_customer_id
  where customer_id is null and email = v_email;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    -- refresh_customer_stats reagiert nicht auf customer_id, deshalb hier neu rechnen
    update public.customers c set
      orders_count      = s.cnt,
      total_spent_cents = s.total,
      first_order_at    = s.first_at,
      last_order_at     = s.last_at
    from (
      select count(*) as cnt, coalesce(sum(total_cents), 0) as total, min(placed_at) as first_at, max(placed_at) as last_at
      from public.orders where customer_id = p_customer_id
        and payment_status in ('paid', 'partially_refunded') and status <> 'cancelled' and not is_test
    ) s
    where c.id = p_customer_id;
    insert into public.customer_events (customer_id, kind, data)
    values (p_customer_id, 'guest_orders_claimed', jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

-- 2. Kunde anlegen oder verknüpfen ---------------------------------------------
-- Unbestätigt: nur neu anlegen, wenn die Adresse frei ist. Bestehende Kunden (Gast, Shopify-Import)
-- werden erst nach der Bestätigung verknüpft.
create or replace function public.link_auth_user_to_customer(
  p_user_id uuid, p_email text, p_confirmed boolean, p_meta jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if p_email is null or p_email = '' then
    return null;
  end if;
  select id into v_id from public.customers where auth_user_id = p_user_id;
  if v_id is null then
    if p_confirmed then
      insert into public.customers (auth_user_id, email, first_name, last_name)
      values (p_user_id, p_email, nullif(p_meta ->> 'first_name', ''), nullif(p_meta ->> 'last_name', ''))
      on conflict (email) do update set auth_user_id = excluded.auth_user_id
      where public.customers.auth_user_id is null and public.customers.anonymized_at is null
      returning id into v_id;
    else
      insert into public.customers (auth_user_id, email, first_name, last_name)
      values (p_user_id, p_email, nullif(p_meta ->> 'first_name', ''), nullif(p_meta ->> 'last_name', ''))
      on conflict (email) do nothing
      returning id into v_id;
    end if;
    if v_id is not null then
      insert into public.customer_events (customer_id, kind, data)
      values (v_id, 'auth_linked', jsonb_build_object('confirmed', p_confirmed));
    end if;
  end if;
  if v_id is not null and p_confirmed then
    perform public.claim_guest_orders_for(v_id);
  end if;
  return v_id;
end $$;

-- Neuer Auth-Benutzer: Staff-Einladung einlösen, sonst Kunde anlegen beziehungsweise verknüpfen.
-- Fehler im Kundenteil dürfen die Anmeldung nicht blockieren (Supabase-Empfehlung für Auth-Trigger).
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_invite public.staff_invites%rowtype;
begin
  select * into v_invite from public.staff_invites where email = new.email and accepted_at is null;
  if found then
    insert into public.staff_users (user_id, email, role, display_name)
    values (new.id, new.email, v_invite.role, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
    on conflict (user_id) do nothing;
    update public.staff_invites set accepted_at = now() where email = new.email;
    return new;
  end if;

  begin
    perform public.link_auth_user_to_customer(
      new.id, new.email, (to_jsonb(new) ->> 'email_confirmed_at') is not null,
      coalesce(new.raw_user_meta_data, '{}'::jsonb));
  exception when others then
    raise warning 'handle_new_auth_user: Kunde für % nicht verknüpft: %', new.id, sqlerrm;
  end;
  return new;
end $$;

-- 3. Kunde zusammenführen (E-Mail-Wechsel auf die Adresse eines Gastkunden) ----------
-- Alle Fremdschlüssel auf customers werden generisch umgehängt, damit spätere Tabellen
-- (zum Beispiel Abo-Historie) automatisch mitwandern.
create or replace function public.merge_customer_into(p_source uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if p_source = p_target then return; end if;
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.customers'::regclass and array_length(c.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_target, p_source;
  end loop;
  update public.customers set
    email         = 'zusammengefuehrt+' || id::text || '@invalid.provibe-drinks.de',
    first_name    = null, last_name = null, phone = null,
    tags          = array_append(tags, 'zusammengefuehrt'),
    anonymized_at = now()
  where id = p_source;
  insert into public.customer_events (customer_id, kind, data)
  values (p_target, 'customer_merged', jsonb_build_object('source', p_source));
end $$;

-- Auth-Benutzer geändert: E-Mail bestätigt oder geändert
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cust  public.customers%rowtype;
  v_other public.customers%rowtype;
begin
  if (to_jsonb(new) ->> 'email_confirmed_at') is null or new.email is null then
    return new;
  end if;
  if exists (select 1 from public.staff_users where user_id = new.id) then
    return new;
  end if;

  begin
    select * into v_cust from public.customers where auth_user_id = new.id;
    if found and v_cust.email is distinct from new.email::citext then
      select * into v_other from public.customers where email = new.email::citext and id <> v_cust.id;
      if found then
        if v_other.auth_user_id is null then
          perform public.merge_customer_into(v_other.id, v_cust.id);
        else
          insert into public.customer_events (customer_id, kind, data)
          values (v_cust.id, 'email_change_conflict', jsonb_build_object('new', new.email));
          return new;
        end if;
      end if;
      update public.customers set email = new.email where id = v_cust.id;
      insert into public.customer_events (customer_id, kind, data)
      values (v_cust.id, 'email_changed', jsonb_build_object('old', v_cust.email, 'new', new.email));
    end if;

    perform public.link_auth_user_to_customer(new.id, new.email, true, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  exception when others then
    raise warning 'handle_auth_user_updated: Kunde für % nicht aktualisiert: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users for each row
when (old.email is distinct from new.email
      or (to_jsonb(old) ->> 'email_confirmed_at') is distinct from (to_jsonb(new) ->> 'email_confirmed_at'))
execute function public.handle_auth_user_updated();

-- 4. Schutz der Kundenspalten ------------------------------------------------------
create or replace function public.guard_customer_self_update()
returns trigger language plpgsql set search_path = public, extensions as $$
declare v_allowed text[] := array['first_name', 'last_name', 'phone', 'locale', 'updated_at'];
begin
  if current_user in ('authenticated', 'anon') and not public.is_staff() then
    if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception 'Kunden dürfen nur Name, Telefon und Sprache ändern' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists customers_guard_self_update on public.customers;
create trigger customers_guard_self_update
before update on public.customers for each row execute function public.guard_customer_self_update();

-- 5. Konto löschen: pseudonymisieren, Bestellungen behalten ----------------------------
create or replace function public.anonymize_customer(p_customer_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_email citext;
begin
  select email into v_email from public.customers where id = p_customer_id and anonymized_at is null;
  if v_email is null then
    return;
  end if;
  if exists (select 1 from public.subscriptions where customer_id = p_customer_id
             and status in ('active', 'paused', 'past_due')) then
    raise exception 'Kunde hat ein laufendes Abo' using errcode = 'P0001';
  end if;

  delete from public.customer_addresses where customer_id = p_customer_id;
  update public.carts set customer_id = null, email = null where customer_id = p_customer_id and status = 'active';
  update public.newsletter_contacts set
    status = 'unsubscribed', unsubscribed_at = coalesce(unsubscribed_at, now()),
    unsubscribe_reason = 'konto_geloescht', first_name = null, confirm_token_hash = null
  where customer_id = p_customer_id or email = v_email;
  update public.customers set
    email               = 'geloescht+' || id::text || '@invalid.provibe-drinks.de',
    auth_user_id        = null,
    first_name          = null,
    last_name           = null,
    phone               = null,
    company_name        = null,
    vat_id              = null,
    acquisition_details = '{}'::jsonb,
    tags                = array_append(tags, 'geloescht'),
    anonymized_at       = now()
  where id = p_customer_id;
  insert into public.customer_events (customer_id, kind, data)
  values (p_customer_id, 'account_deleted', '{}'::jsonb);
end $$;

-- 6. Warenkörbe zusammenführen ---------------------------------------------------------
-- Positionen aus p_source wandern nach p_target (Mengen addiert, höchstens 48 je Position),
-- p_source wird als merged markiert. Liefert die Anzahl übernommener Positionen.
create or replace function public.merge_cart_into(p_source uuid, p_target uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_count integer := 0;
begin
  if p_source = p_target then return 0; end if;
  perform 1 from public.carts where id in (p_source, p_target) for update;
  insert into public.cart_items (cart_id, variant_id, quantity, added_at)
  select p_target, variant_id, least(quantity, 48), added_at from public.cart_items where cart_id = p_source
  on conflict (cart_id, variant_id) do update
    set quantity = least(public.cart_items.quantity + excluded.quantity, 48);
  get diagnostics v_count = row_count;
  update public.carts set status = 'merged', updated_at = now() where id = p_source;
  update public.carts set last_activity_at = now(), updated_at = now() where id = p_target;
  return v_count;
end $$;

-- Rechte: nur Service Role (Server Actions), nie anon/authenticated -------------------
revoke execute on function public.claim_guest_orders_for(uuid) from public, anon, authenticated;
revoke execute on function public.link_auth_user_to_customer(uuid, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.merge_customer_into(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_auth_user_updated() from public, anon, authenticated;
revoke execute on function public.anonymize_customer(uuid) from public, anon, authenticated;
revoke execute on function public.merge_cart_into(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.guard_customer_self_update() from public, anon;
grant execute on function public.claim_guest_orders_for(uuid) to service_role;
grant execute on function public.link_auth_user_to_customer(uuid, text, boolean, jsonb) to service_role;
grant execute on function public.anonymize_customer(uuid) to service_role;
grant execute on function public.merge_cart_into(uuid, uuid) to service_role;
