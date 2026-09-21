-- 0009 Bestellungen, Positionen, Sendungen, Erstattungen, Zahlungs-Events

create type public.order_status       as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded');
create type public.payment_status     as enum ('unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed');
create type public.fulfillment_status as enum ('unfulfilled', 'partial', 'fulfilled');
create type public.invoice_status     as enum ('none', 'queued', 'draft', 'finalized', 'sent', 'failed');
create type public.shipment_status    as enum ('label_created', 'shipped', 'in_transit', 'delivered', 'returned', 'cancelled', 'manual');
create type public.refund_status      as enum ('pending', 'succeeded', 'failed', 'cancelled');

create sequence public.order_number_seq start with 10001;

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default ('PV-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  status               public.order_status not null default 'pending',
  payment_status       public.payment_status not null default 'unpaid',
  fulfillment_status   public.fulfillment_status not null default 'unfulfilled',
  customer_id          uuid references public.customers (id) on delete set null,
  email                citext not null,
  phone                text,
  locale               text not null default 'de',
  currency             text not null default 'EUR',
  -- Beträge in Cent, Bruttopreise (inkl. MwSt.)
  subtotal_cents       integer not null default 0,   -- Warenwert ohne Pfand, vor Rabatt
  discount_cents       integer not null default 0,
  shipping_cents       integer not null default 0,
  deposit_cents        integer not null default 0,   -- Pfand gesamt, getrennt ausgewiesen
  tax_cents            integer not null default 0,   -- enthaltene MwSt. gesamt
  total_cents          integer not null default 0,
  tax_lines            jsonb not null default '[]'::jsonb,  -- [{"rate_bp":1900,"taxable_cents":...,"tax_cents":...}]
  shipping_address     jsonb not null,
  billing_address      jsonb,
  shipping_rate_id     uuid references public.shipping_rates (id) on delete set null,
  shipping_rate_name   text,
  discount_code        text,
  discount_code_id     uuid references public.discount_codes (id) on delete set null,
  payment_provider     text not null default 'stripe',
  payment_intent_id    text unique,                  -- Idempotenz: eine Bestellung je PaymentIntent
  payment_method_type  text,                         -- card, klarna, paypal, sepa_debit, ...
  paid_at              timestamptz,
  checkout_session_id  uuid unique references public.checkout_sessions (id) on delete set null,
  cart_id              uuid references public.carts (id) on delete set null,
  legal_versions       jsonb not null default '{}'::jsonb,
  attribution          jsonb not null default '{}'::jsonb,
  customer_note        text,
  is_test              boolean not null default false,
  source               text not null default 'web',  -- web | admin | shopify_import | subscription
  shopify_order_id     bigint unique,
  shopify_order_name   text,
  -- Lexware Office
  lexware_contact_id   text,
  lexware_invoice_id   text,
  invoice_number       text,
  invoice_pdf_path     text,                         -- Supabase Storage (Bucket invoices), unveränderbar
  invoice_status       public.invoice_status not null default 'none',
  invoice_error        text,
  -- Zeitpunkte
  placed_at            timestamptz not null default now(),
  shipped_at           timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        text,
  review_request_sent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_email_idx on public.orders (email);
create index orders_placed_idx on public.orders (placed_at desc);

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  variant_id         uuid references public.product_variants (id) on delete set null,
  product_id         uuid references public.products (id) on delete set null,
  product_handle     text,
  product_title      text not null,
  variant_title      text,
  sku                text,
  image_path         text,
  quantity           integer not null check (quantity > 0),
  unit_count         integer not null default 1,
  unit_price_cents   integer not null,     -- brutto, ohne Pfand
  unit_deposit_cents integer not null default 0,
  discount_cents     integer not null default 0,   -- anteilig zugeordneter Rabatt
  tax_class          text not null default 'standard',
  tax_rate_bp        integer not null default 1900,
  line_total_cents   integer not null,     -- quantity * (unit_price + unit_deposit) - discount
  weight_grams       integer,
  base_price_text    text,                 -- z.B. '8,03 € / l' (Snapshot für Rechnung und Mails)
  components         jsonb,                -- Bundle-Snapshot
  fulfilled_quantity integer not null default 0,
  refunded_quantity  integer not null default 0,
  position           integer not null default 0
);
create index order_items_order_idx on public.order_items (order_id, position);
create index order_items_variant_idx on public.order_items (variant_id);

alter table public.discount_redemptions
  add constraint discount_redemptions_order_fk foreign key (order_id) references public.orders (id) on delete cascade;
alter table public.checkout_sessions
  add constraint checkout_sessions_order_fk foreign key (order_id) references public.orders (id) on delete set null;
alter table public.carts
  add constraint carts_converted_order_fk foreign key (converted_order_id) references public.orders (id) on delete set null;

create table public.order_events (
  id                  bigint generated always as identity primary key,
  order_id            uuid not null references public.orders (id) on delete cascade,
  kind                text not null,          -- status_changed, email_sent, invoice_created, refund, note, shipment
  message             text,
  data                jsonb not null default '{}'::jsonb,
  actor_user_id       uuid,
  visible_to_customer boolean not null default false,
  created_at          timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at desc);

create table public.order_notes (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  author_user_id uuid,
  body           text not null,
  created_at     timestamptz not null default now()
);

create table public.shipments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  carrier             text not null default 'dhl',
  service             text,
  tracking_number     text,
  tracking_url        text,
  status              public.shipment_status not null default 'manual',
  label_bucket        text,
  label_path          text,
  dhl_shipment_number text,
  weight_grams        integer,
  items               jsonb not null default '[]'::jsonb,   -- [{"order_item_id":"...","quantity":1}]
  is_return           boolean not null default false,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  customer_notified_at timestamptz,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);

create table public.refunds (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  provider                text not null default 'stripe',
  provider_refund_id      text unique,
  amount_cents            integer not null check (amount_cents > 0),
  reason                  text,
  items                   jsonb not null default '[]'::jsonb,
  restock                 boolean not null default false,
  status                  public.refund_status not null default 'pending',
  lexware_credit_note_id  text,
  credit_note_number      text,
  credit_note_pdf_path    text,
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Eingehende Webhook-Events (Stripe, Resend, DHL): Idempotenz über event_id
create table public.webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null,
  event_id         text not null,
  event_type       text not null,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  processing_error text,
  order_id         uuid references public.orders (id) on delete set null,
  unique (provider, event_id)
);

-- Kundenkennzahlen aktualisieren, sobald eine Bestellung bezahlt ist
create or replace function public.refresh_customer_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and (tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status
     or old.total_cents is distinct from new.total_cents or old.status is distinct from new.status) then
    update public.customers c set
      orders_count     = s.cnt,
      total_spent_cents = s.total,
      first_order_at   = s.first_at,
      last_order_at    = s.last_at,
      updated_at       = now()
    from (
      select count(*) as cnt, coalesce(sum(total_cents), 0) as total, min(placed_at) as first_at, max(placed_at) as last_at
      from public.orders where customer_id = new.customer_id
        and payment_status in ('paid', 'partially_refunded') and status <> 'cancelled' and not is_test
    ) s
    where c.id = new.customer_id;
  end if;
  return new;
end $$;
create trigger orders_refresh_customer_stats after insert or update on public.orders
for each row execute function public.refresh_customer_stats();
