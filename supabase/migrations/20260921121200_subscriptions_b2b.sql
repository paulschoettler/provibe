-- 0013 Vorbereitung Abo (Phase 2) und gespeicherte Zahlungsmittel. Keine Oberfläche, kein Verkauf.

create type public.subscription_status as enum ('draft', 'active', 'paused', 'past_due', 'cancelled');

create table public.customer_payment_methods (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references public.customers (id) on delete cascade,
  stripe_customer_id       text not null,
  stripe_payment_method_id text not null unique,     -- über SetupIntent gespeichert
  type                     text not null,            -- card, sepa_debit, paypal
  brand                    text,
  last4                    text,
  exp_month                integer,
  exp_year                 integer,
  is_default               boolean not null default false,
  created_at               timestamptz not null default now()
);

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid not null references public.customers (id) on delete restrict,
  status                 public.subscription_status not null default 'draft',
  variant_id             uuid not null references public.product_variants (id) on delete restrict,
  quantity               integer not null default 1 check (quantity > 0),
  interval_unit          text not null default 'week' check (interval_unit in ('week', 'month')),
  interval_count         integer not null default 4 check (interval_count > 0),
  discount_bp            integer not null default 0,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  payment_method_id      uuid references public.customer_payment_methods (id) on delete set null,
  shipping_address       jsonb,
  next_order_at          timestamptz,
  last_order_at          timestamptz,
  paused_until           timestamptz,
  cancelled_at           timestamptz,
  cancel_reason          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions (customer_id);

create table public.subscription_orders (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  order_id        uuid not null references public.orders (id) on delete cascade,
  primary key (subscription_id, order_id)
);

-- B2B: Anfragen zur Freischaltung (Phase 2), Datenmodell vorbereitet
create table public.b2b_applications (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  company_name  text not null,
  vat_id        text,
  trade_register text,
  message       text,
  status        public.b2b_status not null default 'requested',
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
