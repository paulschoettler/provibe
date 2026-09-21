-- 0005 Kunden (B2C, B2B vorbereitet), Adressen, Preislisten, Auth-Trigger

create type public.customer_type as enum ('b2c', 'b2b');
create type public.b2b_status    as enum ('none', 'requested', 'approved', 'rejected');

create table public.price_lists (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  currency            text not null default 'EUR',
  prices_include_tax  boolean not null default true,   -- B2B: false (Nettopreise)
  is_default          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.price_list_entries (
  price_list_id uuid not null references public.price_lists (id) on delete cascade,
  variant_id    uuid not null references public.product_variants (id) on delete cascade,
  min_quantity  integer not null default 1 check (min_quantity > 0),
  price_cents   integer not null check (price_cents >= 0),
  primary key (price_list_id, variant_id, min_quantity)
);

create table public.customers (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique references auth.users (id) on delete set null,
  email                citext not null unique,
  first_name           text,
  last_name            text,
  phone                text,
  customer_type        public.customer_type not null default 'b2c',
  company_name         text,
  vat_id               text,
  b2b_status           public.b2b_status not null default 'none',
  price_list_id        uuid references public.price_lists (id) on delete set null,
  payment_terms        text,                          -- z.B. 'invoice_14d' (Kauf auf Rechnung, Phase 2)
  locale               text not null default 'de',
  tags                 text[] not null default '{}',
  acquisition_source   text,
  acquisition_details  jsonb not null default '{}'::jsonb,
  stripe_customer_id   text unique,
  shopify_customer_id  bigint unique,
  orders_count         integer not null default 0,
  total_spent_cents    bigint not null default 0,
  first_order_at       timestamptz,
  last_order_at        timestamptz,
  activation_email_sent_at timestamptz,               -- "Konto aktivieren" nach Migration
  anonymized_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index customers_name_idx on public.customers using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) extensions.gin_trgm_ops);
create index customers_tags_idx on public.customers using gin (tags);

create table public.customer_addresses (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers (id) on delete cascade,
  label               text,
  first_name          text not null,
  last_name           text not null,
  company             text,
  street              text not null,
  house_number        text,                            -- DHL braucht Straße und Hausnummer getrennt
  address_addition    text,
  postal_code         text not null,
  city                text not null,
  country_code        char(2) not null default 'DE',
  phone               text,
  is_default_shipping boolean not null default false,
  is_default_billing  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses (customer_id);

create table public.customer_notes (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete cascade,
  author_user_id uuid,
  body           text not null,
  created_at     timestamptz not null default now()
);

-- Aktivitäts-Timeline (Bestellung, Mail, Newsletter, Login, Notiz)
create table public.customer_events (
  id          bigint generated always as identity primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index customer_events_customer_idx on public.customer_events (customer_id, created_at desc);

create table public.saved_segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  definition  jsonb not null,           -- Filterdefinition, Auswertung in der Anwendung
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;
revoke execute on function public.current_customer_id() from public, anon;
grant execute on function public.current_customer_id() to authenticated, service_role;

-- Neuer Auth-Benutzer: Staff-Einladung einlösen oder Kundendatensatz anlegen/verknüpfen
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  insert into public.customers (auth_user_id, email, first_name, last_name)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')
  on conflict (email) do update set auth_user_id = excluded.auth_user_id, updated_at = now()
  where public.customers.auth_user_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_auth_user();
