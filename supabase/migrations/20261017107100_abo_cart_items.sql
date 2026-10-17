-- Abo 1071: Abo-Positionen im Warenkorb.
--
-- cart_items bekommt is_subscription und subscription_interval_weeks. Dieselbe Variante darf einmal
-- als Einmalkauf und einmal als Abo im Warenkorb liegen (Mischwarenkorb), deshalb wird die
-- Eindeutigkeit (cart_id, variant_id) zu (cart_id, variant_id, is_subscription).
-- merge_cart_into (Konto 1030) übernimmt beim Login beide Spalten und nutzt den neuen Schlüssel.
--
-- Idempotent: add column if not exists, Constraint nur entfernen, wenn vorhanden, create or replace.
--
-- Rückweg (vorher Abo-Positionen entfernen, sonst scheitert der alte Unique-Schlüssel):
--   delete from public.cart_items where is_subscription;
--   drop index if exists public.cart_items_cart_variant_kind_key;
--   alter table public.cart_items add constraint cart_items_cart_id_variant_id_key unique (cart_id, variant_id);
--   alter table public.cart_items drop constraint if exists cart_items_subscription_interval_check;
--   alter table public.cart_items drop column if exists subscription_interval_weeks, drop column if exists is_subscription;
--   danach merge_cart_into aus 20261017103000_konto_auth.sql erneut ausführen.

alter table public.cart_items
  add column if not exists is_subscription boolean not null default false,
  add column if not exists subscription_interval_weeks integer;

do $$
begin
  -- neu anlegen statt nur bei Fehlen, damit eine korrigierte Fassung auch wiederholt greift
  alter table public.cart_items drop constraint if exists cart_items_subscription_interval_check;
  alter table public.cart_items add constraint cart_items_subscription_interval_check check (
    (is_subscription and subscription_interval_weeks is not null and subscription_interval_weeks between 1 and 52)
    or (not is_subscription and subscription_interval_weeks is null));
  if exists (select 1 from pg_constraint where conname = 'cart_items_cart_id_variant_id_key') then
    alter table public.cart_items drop constraint cart_items_cart_id_variant_id_key;
  end if;
end $$;

create unique index if not exists cart_items_cart_variant_kind_key
  on public.cart_items (cart_id, variant_id, is_subscription);

create or replace function public.merge_cart_into(p_source uuid, p_target uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_count integer := 0;
begin
  if p_source = p_target then return 0; end if;
  perform 1 from public.carts where id in (p_source, p_target) for update;
  insert into public.cart_items (cart_id, variant_id, quantity, added_at, is_subscription, subscription_interval_weeks)
  select p_target, variant_id, least(quantity, 48), added_at, is_subscription, subscription_interval_weeks
    from public.cart_items where cart_id = p_source
  on conflict (cart_id, variant_id, is_subscription) do update
    set quantity = least(public.cart_items.quantity + excluded.quantity, 48),
        subscription_interval_weeks = coalesce(excluded.subscription_interval_weeks,
                                               public.cart_items.subscription_interval_weeks);
  get diagnostics v_count = row_count;
  update public.carts set status = 'merged', updated_at = now() where id = p_source;
  update public.carts set last_activity_at = now(), updated_at = now() where id = p_target;
  return v_count;
end $$;

revoke execute on function public.merge_cart_into(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_cart_into(uuid, uuid) to service_role;
