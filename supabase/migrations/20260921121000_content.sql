-- 0011 Inhalte: Seiten, Rechtstexte (versioniert), Startseiten-Module, Blog, Redirects, Medien, Suche

create table public.pages (
  id              uuid primary key default gen_random_uuid(),
  handle          text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  template        text not null default 'default',   -- default | contact | partner | about | investors | withdrawal
  status          public.publish_status not null default 'draft',
  noindex         boolean not null default false,
  show_in_sitemap boolean not null default true,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.page_translations (
  page_id         uuid not null references public.pages (id) on delete cascade,
  locale          text not null default 'de',
  title           text not null,
  body_html       text,
  blocks          jsonb not null default '[]'::jsonb,
  seo_title       text,
  seo_description text,
  og_image_path   text,
  primary key (page_id, locale)
);

create type public.legal_document_kind as enum ('impressum', 'agb', 'widerruf', 'datenschutz', 'versand');

create table public.legal_documents (
  id                 uuid primary key default gen_random_uuid(),
  kind               public.legal_document_kind not null unique,
  path               text not null unique,          -- z.B. /pages/impressum, /policies/privacy-policy
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.legal_document_versions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.legal_documents (id) on delete cascade,
  locale        text not null default 'de',
  version       integer not null,
  title         text not null,
  body_html     text not null,
  change_note   text,
  status        public.publish_status not null default 'draft',
  effective_from timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (document_id, locale, version)
);
create index legal_document_versions_published_idx on public.legal_document_versions (document_id, locale, effective_from desc) where status = 'published';

-- Aktuell gültige Version eines Rechtstexts
create or replace function public.current_legal_version(p_kind public.legal_document_kind, p_locale text default 'de')
returns public.legal_document_versions language sql stable as $$
  select v.* from public.legal_document_versions v
  join public.legal_documents d on d.id = v.document_id
  where d.kind = p_kind and v.locale = p_locale and v.status = 'published'
    and (v.effective_from is null or v.effective_from <= now())
  order by v.effective_from desc nulls last, v.version desc
  limit 1;
$$;

create table public.homepage_modules (
  id         uuid primary key default gen_random_uuid(),
  locale     text not null default 'de',
  kind       text not null,                 -- hero | bestseller | flavors | story | bundles | faq | custom
  position   integer not null default 0,
  is_enabled boolean not null default true,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  handle           text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  blog_handle      text not null default 'news',
  status           public.publish_status not null default 'draft',
  author_name      text,
  cover_image_path text,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.blog_post_translations (
  post_id         uuid not null references public.blog_posts (id) on delete cascade,
  locale          text not null default 'de',
  title           text not null,
  excerpt         text,
  body_html       text,
  seo_title       text,
  seo_description text,
  primary key (post_id, locale)
);

create table public.redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique,
  to_path     text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  is_enabled  boolean not null default true,
  hits        bigint not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  bucket     text not null default 'media',
  path       text not null,
  mime_type  text,
  width      integer,
  height     integer,
  bytes      bigint,
  alt        jsonb not null default '{}'::jsonb,
  focal_x    numeric(4,3),
  focal_y    numeric(4,3),
  tags       text[] not null default '{}',
  source_url text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- Volltextsuche über Produkte und Seiten (servergerendert, kein Client-Only)
create index product_translations_search_idx on public.product_translations
  using gin ((coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(description_html,'')) extensions.gin_trgm_ops);
create index page_translations_search_idx on public.page_translations
  using gin ((coalesce(title,'') || ' ' || coalesce(body_html,'')) extensions.gin_trgm_ops);

create or replace function public.search_storefront(p_query text, p_locale text default 'de', p_limit integer default 20)
returns table (kind text, id uuid, handle text, title text, subtitle text, rank real)
language sql stable security definer set search_path = public as $$
  with q as (select lower(trim(p_query)) as q)
  (select 'product'::text as kind, p.id as id, p.handle as handle, t.title as title, t.subtitle as subtitle,
          greatest(extensions.similarity(lower(t.title), (select q from q)),
                   case when lower(t.title) like '%' || (select q from q) || '%' then 0.9 else 0 end,
                   case when lower(coalesce(t.description_html,'')) like '%' || (select q from q) || '%' then 0.3 else 0 end)::real as rank
   from public.products p join public.product_translations t on t.product_id = p.id and t.locale = p_locale
   where p.status = 'active')
  union all
  (select 'page'::text, pg.id, pg.handle, t.title, null,
          greatest(extensions.similarity(lower(t.title), (select q from q)),
                   case when lower(t.title) like '%' || (select q from q) || '%' then 0.8 else 0 end,
                   case when lower(coalesce(t.body_html,'')) like '%' || (select q from q) || '%' then 0.25 else 0 end)::real as rank
   from public.pages pg join public.page_translations t on t.page_id = pg.id and t.locale = p_locale
   where pg.status = 'published' and not pg.noindex)
  order by rank desc
  limit p_limit;
$$;
