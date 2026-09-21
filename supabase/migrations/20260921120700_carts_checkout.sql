-- 0008 Warenkörbe (persistent), Checkout-Sessions

create type public.cart_status     as enum ('active', 'converted', 'abandoned', 'merged');
create type public.checkout_status as enum ('open', 'processing', 'completed', 'expired', 'cancelled', 'failed');

create table public.carts (
  id                     uuid primary key default gen_random_uuid(),
  token                  text not null unique default public.random_token(24),  -- im httpOnly-Cookie
  customer_id            uuid references public.customers (id) on delete set null,
  email                  citext,
  status                 public.cart_status not null default 'active',
  currency               text not null default 'EUR',
  locale                 text not null default 'de',
  discount_code_id       uuid references public.discount_codes (id) on delete set null,
  note                   text,
  attribution            jsonb not null default '{}'::jsonb,  -- utm_*, gclid, fbclid, ttclid, landing_page, referrer, consent
  last_activity_at       timestamptz not null default now(),
  converted_order_id     uuid,
  abandoned_email_sent_at timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index carts_customer_idx on public.carts (customer_id) where status = 'active';
create index carts_abandoned_idx on public.carts (last_activity_at) where status = 'active' and email is not null;

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  added_at   timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.checkout_sessions (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid not null references public.carts (id) on delete restrict,
  customer_id        uuid references public.customers (id) on delete set null,
  email              citext,
  phone              text,
  status             public.checkout_status not null default 'open',
  payment_provider   text not null default 'stripe',
  payment_intent_id  text unique,
  amounts            jsonb,                 -- serverseitig berechneter Snapshot (Positionen, Rabatt, Versand, Pfand, Steuern, Gesamt)
  shipping_address   jsonb,
  billing_address    jsonb,
  shipping_rate_id   uuid references public.shipping_rates (id) on delete set null,
  shipping_method    jsonb,
  discount_code      text,
  legal_versions     jsonb,                 -- {"agb": "<version_id>", "widerruf": "<version_id>", "datenschutz": "<version_id>"}
  marketing_opt_in   boolean not null default false,
  create_account     boolean not null default false,
  order_id           uuid,
  attribution        jsonb not null default '{}'::jsonb,
  expires_at         timestamptz not null default now() + interval '30 minutes',
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index checkout_sessions_cart_idx on public.checkout_sessions (cart_id);
create index checkout_sessions_open_idx on public.checkout_sessions (expires_at) where status = 'open';

alter table public.inventory_reservations
  add constraint inventory_reservations_session_fk
  foreign key (checkout_session_id) references public.checkout_sessions (id) on delete cascade;
