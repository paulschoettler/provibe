-- 0007 Rabattcodes

create type public.discount_kind as enum ('percentage', 'fixed_amount', 'free_shipping');

create table public.discount_codes (
  id                       uuid primary key default gen_random_uuid(),
  code                     citext not null unique,
  title                    text,
  kind                     public.discount_kind not null,
  value                    integer not null default 0 check (value >= 0),  -- percentage: Basispunkte (1000 = 10 %), fixed_amount: Cent
  applies_to               jsonb not null default '{"scope":"order"}'::jsonb, -- scope: order | products | collections (+ ids)
  min_subtotal_cents       integer not null default 0,
  starts_at                timestamptz,
  ends_at                  timestamptz,
  usage_limit              integer,
  usage_limit_per_customer integer,
  usage_count              integer not null default 0,
  is_active                boolean not null default true,
  combinable               boolean not null default false,
  customer_type            public.customer_type,     -- null = alle
  shopify_discount_id      text,
  created_by               uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.discount_redemptions (
  id               uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes (id) on delete cascade,
  order_id         uuid not null,
  customer_id      uuid references public.customers (id) on delete set null,
  email            citext not null,
  amount_cents     integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (discount_code_id, order_id)
);
create index discount_redemptions_email_idx on public.discount_redemptions (discount_code_id, email);

create or replace function public.bump_discount_usage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.discount_codes set usage_count = usage_count + 1, updated_at = now()
  where id = new.discount_code_id;
  return new;
end $$;
create trigger discount_redemptions_bump after insert on public.discount_redemptions
for each row execute function public.bump_discount_usage();
