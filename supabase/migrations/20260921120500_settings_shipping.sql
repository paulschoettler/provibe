-- 0006 Shop-Einstellungen, Steuern, Versandzonen, Announcement-Bar, Navigation

create table public.shop_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,   -- öffentlich lesbare Einstellungen (Shopname, Tracking-IDs, Kontakt)
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.tax_rates (
  id           uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  tax_class    text not null default 'standard',
  rate_bp      integer not null check (rate_bp between 0 and 10000),   -- 1900 = 19 %
  name         text not null,
  valid_from   date not null default current_date,
  valid_to     date,
  unique (country_code, tax_class, valid_from)
);

create table public.shipping_zones (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  country_codes char(2)[] not null,
  is_enabled    boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.shipping_rates (
  id                        uuid primary key default gen_random_uuid(),
  zone_id                   uuid not null references public.shipping_zones (id) on delete cascade,
  name                      text not null,
  description               text,
  price_cents               integer not null check (price_cents >= 0),
  free_above_subtotal_cents integer,                       -- Versandkostenfrei ab (Warenwert nach Rabatt, ohne Pfand)
  min_subtotal_cents        integer not null default 0,
  max_subtotal_cents        integer,
  min_weight_grams          integer not null default 0,
  max_weight_grams          integer,
  carrier                   text not null default 'dhl',
  service                   text not null default 'V01PAK',  -- DHL Paket
  delivery_time_text        text,
  tax_class                 text not null default 'standard',
  is_enabled                boolean not null default true,
  position                  integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.announcement_messages (
  id         uuid primary key default gen_random_uuid(),
  locale     text not null default 'de',
  message    text not null,
  link_url   text,
  is_active  boolean not null default true,
  position   integer not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menus (
  id     uuid primary key default gen_random_uuid(),
  handle text not null unique,          -- 'main', 'footer-quick', 'footer-legal'
  name   text not null
);

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null references public.menus (id) on delete cascade,
  parent_id     uuid references public.menu_items (id) on delete cascade,
  position      integer not null default 0,
  label         jsonb not null,                -- {"de":"Shop"}
  url           text not null,
  is_external   boolean not null default false,
  opens_new_tab boolean not null default false
);
create index menu_items_menu_idx on public.menu_items (menu_id, position);
