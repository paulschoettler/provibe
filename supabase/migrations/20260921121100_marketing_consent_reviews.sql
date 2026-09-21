-- 0012 Newsletter (Double Opt-in), Kampagnen, Automationen, Consent-Log, Bewertungen, Formulare

create type public.newsletter_status as enum ('pending', 'subscribed', 'unsubscribed', 'bounced', 'complained');

create table public.newsletter_contacts (
  id                  uuid primary key default gen_random_uuid(),
  email               citext not null unique,
  status              public.newsletter_status not null default 'pending',
  customer_id         uuid references public.customers (id) on delete set null,
  first_name          text,
  source              text not null default 'footer',     -- footer | checkout | import_shopify | admin | popup
  resend_contact_id   text,
  confirm_token_hash  text,
  opt_in_sent_at      timestamptz,
  confirmed_at        timestamptz,
  confirm_ip          inet,
  confirm_user_agent  text,
  consent_text        text,                               -- Wortlaut der Einwilligung zum Zeitpunkt
  consent_version     text,
  imported_consent_at timestamptz,                        -- Shopify-Zeitstempel bei Import
  unsubscribed_at     timestamptz,
  unsubscribe_reason  text,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index newsletter_contacts_status_idx on public.newsletter_contacts (status);

create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed');

create table public.newsletter_campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  subject          text not null,
  preheader        text,
  from_email       text,
  status           public.campaign_status not null default 'draft',
  segment_id       uuid references public.saved_segments (id) on delete set null,
  segment_snapshot jsonb,
  content          jsonb not null default '[]'::jsonb,   -- Blöcke des Editors
  html_cache       text,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  recipients_count integer not null default 0,
  stats            jsonb not null default '{}'::jsonb,   -- delivered, opened, clicked, bounced, unsubscribed
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.campaign_recipients (
  campaign_id         uuid not null references public.newsletter_campaigns (id) on delete cascade,
  contact_id          uuid not null references public.newsletter_contacts (id) on delete cascade,
  email               citext not null,
  provider_message_id text,
  status              public.email_status not null default 'queued',
  sent_at             timestamptz,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  bounced_at          timestamptz,
  unsubscribed_at     timestamptz,
  primary key (campaign_id, contact_id)
);

alter table public.email_messages
  add constraint email_messages_campaign_fk foreign key (campaign_id) references public.newsletter_campaigns (id) on delete set null;

create table public.automations (
  key        text primary key,                 -- welcome | abandoned_cart | review_request
  name       text not null,
  is_enabled boolean not null default false,
  config     jsonb not null default '{}'::jsonb,  -- z.B. {"delay_hours":24}
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id             uuid primary key default gen_random_uuid(),
  automation_key text not null references public.automations (key) on delete cascade,
  target_type    text not null,                -- cart | order | contact
  target_id      uuid not null,
  email          citext not null,
  status         text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'failed')),
  scheduled_for  timestamptz not null,
  sent_at        timestamptz,
  skip_reason    text,
  error          text,
  created_at     timestamptz not null default now(),
  unique (automation_key, target_type, target_id)
);

-- Consent-Log (TDDDG / DSGVO): jede Entscheidung im Banner
create table public.consent_logs (
  id             bigint generated always as identity primary key,
  anonymous_id   text not null,                 -- Cookie-ID des Consent-Banners
  customer_id    uuid references public.customers (id) on delete set null,
  action         text not null check (action in ('accept_all', 'reject_all', 'custom', 'withdraw')),
  categories     jsonb not null,                -- {"necessary":true,"analytics":false,"marketing":false}
  banner_version text not null,
  ip_hash        text,
  user_agent     text,
  page_url       text,
  created_at     timestamptz not null default now()
);
create index consent_logs_anonymous_idx on public.consent_logs (anonymous_id, created_at desc);

create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products (id) on delete cascade,
  order_id             uuid references public.orders (id) on delete set null,
  order_item_id        uuid unique references public.order_items (id) on delete set null,
  customer_id          uuid references public.customers (id) on delete set null,
  author_name          text not null,
  rating               integer not null check (rating between 1 and 5),
  title                text,
  body                 text,
  status               public.review_status not null default 'pending',
  is_verified_purchase boolean not null default true,
  token_hash           text,                     -- Link aus der Bewertungsanfrage-Mail
  moderated_by         uuid,
  moderated_at         timestamptz,
  reply_body           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index reviews_product_idx on public.reviews (product_id, status);

create type public.lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');

create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null default 'partner',
  company        text,
  contact_name   text not null,
  email          citext not null,
  phone          text,
  location_type  text,                            -- Gym, Einzelhandel, Gastro, Hotel
  message        text,
  status         public.lead_status not null default 'new',
  assigned_to    uuid,
  customer_id    uuid references public.customers (id) on delete set null,
  source_url     text,
  attribution    jsonb not null default '{}'::jsonb,
  ip_hash        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.lead_notes (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id) on delete cascade,
  author_user_id uuid,
  body           text not null,
  created_at     timestamptz not null default now()
);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      citext not null,
  phone      text,
  message    text not null,
  status     text not null default 'new' check (status in ('new', 'answered', 'spam', 'archived')),
  ip_hash    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Elektronische Widerrufsfunktion (§ 312k BGB analog, Pflicht seit Juni 2026)
create table public.withdrawal_requests (
  id                         uuid primary key default gen_random_uuid(),
  order_number               text,
  order_id                   uuid references public.orders (id) on delete set null,
  customer_name              text not null,
  email                      citext not null,
  address                    text,
  items_description          text not null,
  ordered_on                 date,
  received_on                date,
  message                    text,
  status                     text not null default 'received' check (status in ('received', 'confirmed', 'processed', 'rejected')),
  confirmation_email_sent_at timestamptz,
  ip_hash                    text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- Rate-Limits für Formulare, Login, Rabattcode-Prüfung (Schlüssel z.B. 'contact:<ip_hash>')
create table public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when public.rate_limits.window_start < now() - p_window then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < now() - p_window then now() else public.rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end $$;
