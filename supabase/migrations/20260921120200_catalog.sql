-- 0003 Katalog: Produkte, Varianten, Bundles, Kollektionen, Preishistorie

create type public.product_status  as enum ('draft', 'active', 'archived');
create type public.product_kind    as enum ('simple', 'bundle');
create type public.compare_at_kind as enum ('none', 'former_price', 'components_sum', 'quantity_reference');
create type public.unit_measure    as enum ('l', 'kg', 'piece');
create type public.publish_status  as enum ('draft', 'published', 'archived');

create table public.products (
  id                     uuid primary key default gen_random_uuid(),
  handle                 text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status                 public.product_status not null default 'draft',
  kind                   public.product_kind not null default 'simple',
  vendor                 text not null default 'provibe',
  product_type           text,
  tags                   text[] not null default '{}',
  tax_class              text not null default 'standard',
  is_food                boolean not null default false,
  -- Pfand je Einheit (Dose) in Cent, Standard 0. Wird getrennt vom Preis ausgewiesen (PAngV § 7).
  deposit_cents_per_unit integer not null default 0 check (deposit_cents_per_unit >= 0),
  unit_label             text not null default 'Stück',       -- 'Dose', 'Stück'
  net_content_per_unit   numeric(10,3),                          -- z.B. 0.330
  net_content_measure    public.unit_measure not null default 'piece',
  base_price_measure     public.unit_measure not null default 'piece', -- Grundpreis je Liter / kg / Stück
  weight_grams_per_unit  integer check (weight_grams_per_unit is null or weight_grams_per_unit >= 0),
  attributes             jsonb not null default '{}'::jsonb,      -- z.B. {"lactose_free":true,"protein_g_per_unit":15}
  min_quantity_b2b       integer,                                 -- Vorbereitung B2B
  shopify_product_id     bigint unique,
  position               integer not null default 0,
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index products_status_idx on public.products (status, position);

create table public.product_translations (
  product_id             uuid not null references public.products (id) on delete cascade,
  locale                 text not null default 'de',
  title                  text not null,
  subtitle               text,
  description_html       text,
  delivery_time_text     text,                    -- z.B. '3–5 Werktage'
  seo_title              text,
  seo_description        text,
  og_image_path          text,
  -- LMIV-Pflichtangaben (Pflicht bei is_food, geprüft in der Anwendung vor Veröffentlichung)
  food_name              text,                    -- Bezeichnung des Lebensmittels
  ingredients_html       text,                    -- Zutaten mit hervorgehobenen Allergenen
  allergens              text,
  nutrition              jsonb,                   -- {"per":"100 ml","energy_kj":91,"energy_kcal":22,"fat_g":"<0,5",...}
  storage_instructions   text,
  food_business_operator text,                    -- Name und Anschrift
  country_of_origin      text,
  faq                    jsonb not null default '[]'::jsonb,  -- [{"q":"","a":""}]
  primary key (product_id, locale)
);

create table public.product_options (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null,               -- 'Menge', 'Größe'
  position   integer not null default 0,
  values     text[] not null default '{}',
  unique (product_id, name)
);

create table public.product_variants (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products (id) on delete cascade,
  sku                     text unique,
  legacy_sku              text,
  gtin                    text,
  title                   text not null,                    -- '9 Dosen', 'M'
  option_values           jsonb not null default '{}'::jsonb, -- {"Menge":"9"}
  position                integer not null default 0,
  price_cents             integer not null check (price_cents >= 0),
  compare_at_cents        integer check (compare_at_cents is null or compare_at_cents >= 0),
  compare_at_kind         public.compare_at_kind not null default 'none',
  unit_count              integer not null default 1 check (unit_count > 0), -- Anzahl Einheiten (Dosen)
  weight_grams            integer check (weight_grams is null or weight_grams >= 0),
  packaging_weight_grams  integer not null default 0,
  is_active               boolean not null default true,
  min_quantity_b2b        integer,
  shopify_variant_id      bigint unique,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (product_id, option_values)
);
create index product_variants_product_idx on public.product_variants (product_id, position);

create table public.product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  variant_id     uuid references public.product_variants (id) on delete set null,
  storage_bucket text not null default 'product-media',
  storage_path   text not null,
  source_url     text,
  width          integer,
  height         integer,
  alt            jsonb not null default '{}'::jsonb,   -- {"de":"..."}
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);

-- Bundles: Komponenten je Bundle-Variante (z.B. Founder Bundle II in Größe M enthält Shirt M)
create table public.bundle_components (
  bundle_variant_id    uuid not null references public.product_variants (id) on delete cascade,
  component_variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity             integer not null check (quantity > 0),
  primary key (bundle_variant_id, component_variant_id),
  check (bundle_variant_id <> component_variant_id)
);

create table public.collections (
  id                    uuid primary key default gen_random_uuid(),
  handle                text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind                  text not null default 'manual' check (kind in ('manual', 'automatic')),
  rules                 jsonb not null default '[]'::jsonb,   -- [{"field":"tag","op":"eq","value":"eistee"}]
  sort_key              text not null default 'manual',
  status                public.publish_status not null default 'draft',
  image_path            text,
  position              integer not null default 0,
  shopify_collection_id bigint unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.collection_translations (
  collection_id    uuid not null references public.collections (id) on delete cascade,
  locale           text not null default 'de',
  title            text not null,
  description_html text,
  seo_title        text,
  seo_description  text,
  primary key (collection_id, locale)
);

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, product_id)
);

-- Preishistorie für die 30-Tage-Referenz (PAngV § 11)
create table public.price_history (
  id               bigint generated always as identity primary key,
  variant_id       uuid not null references public.product_variants (id) on delete cascade,
  price_cents      integer not null,
  compare_at_cents integer,
  valid_from       timestamptz not null default now(),
  valid_to         timestamptz,
  changed_by       uuid,
  source           text not null default 'admin'
);
create index price_history_variant_idx on public.price_history (variant_id, valid_from desc);

create or replace function public.record_price_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.price_cents = old.price_cents
     and new.compare_at_cents is not distinct from old.compare_at_cents then
    return new;
  end if;
  update public.price_history set valid_to = now()
   where variant_id = new.id and valid_to is null;
  insert into public.price_history (variant_id, price_cents, compare_at_cents, changed_by)
  values (new.id, new.price_cents, new.compare_at_cents, auth.uid());
  return new;
end $$;

create trigger product_variants_price_history
after insert or update of price_cents, compare_at_cents on public.product_variants
for each row execute function public.record_price_history();

-- Niedrigster Preis der letzten 30 Tage (vor jetzt), für Streichpreis-Referenzen
create or replace function public.lowest_price_last_30_days(p_variant_id uuid)
returns integer language sql stable as $$
  select min(price_cents) from public.price_history
  where variant_id = p_variant_id
    and valid_from < now()
    and coalesce(valid_to, now()) > now() - interval '30 days';
$$;

-- Pfand je Variante (Cent)
create or replace function public.variant_deposit_cents(p_variant_id uuid)
returns integer language sql stable as $$
  select p.deposit_cents_per_unit * v.unit_count
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
$$;

-- Grundpreis in Cent je Basiseinheit (Liter/kg/Stück), ohne Pfand (PAngV § 4 Abs. 1 Satz 2 analog)
create or replace function public.variant_base_price_cents(p_variant_id uuid)
returns numeric language sql stable as $$
  select case
    when p.base_price_measure = 'piece' or coalesce(p.net_content_per_unit, 0) = 0
      then (v.price_cents - p.deposit_cents_per_unit * v.unit_count)::numeric / v.unit_count
    else round((v.price_cents - p.deposit_cents_per_unit * v.unit_count)::numeric
               / (v.unit_count * p.net_content_per_unit), 2)
  end
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
$$;

-- Summe der Komponentenpreise eines Bundles (für "Einzeln: X €")
create or replace function public.bundle_components_sum_cents(p_bundle_variant_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(c.quantity * v.price_cents), 0)::integer
  from public.bundle_components c join public.product_variants v on v.id = c.component_variant_id
  where c.bundle_variant_id = p_bundle_variant_id;
$$;
