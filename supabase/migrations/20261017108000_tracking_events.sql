-- 1080 Tracking: Protokoll serverseitiger Events (Paket Consent und Tracking, docs/tracking.md)
--
-- Vorbereitung für Meta Conversions API, TikTok Events API und GA4 Measurement Protocol.
-- Bis zur Freigabe sendet der Shop nichts an Anbieter; recordServerEvent (src/lib/tracking/server.ts)
-- schreibt nur hier hinein. Keine personenbezogenen Daten: Bestellnummer nur als HMAC,
-- Einwilligungsstand aus dem Cookie pv_consent zum Zeitpunkt des Events.
-- Zugriff ausschließlich serverseitig mit dem Service-Role-Client (RLS an, keine Policies).
--
-- Rückweg (nur vor dem Go-live oder nach Freigabe, die Tabelle hat keine Abhängigkeiten):
--   drop table if exists public.tracking_events;

create table if not exists public.tracking_events (
  id                bigint generated always as identity primary key,
  event_name        text not null check (event_name in (
                      'page_view', 'view_item_list', 'view_item', 'search', 'add_to_cart',
                      'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info',
                      'add_payment_info', 'purchase', 'sign_up', 'generate_lead')),
  -- Gemeinsame ID mit dem Browser-Event (Deduplizierung bei den Anbietern), idempotent
  event_id          text not null check (char_length(event_id) between 1 and 120),
  source            text not null default 'server' check (source in ('server', 'browser')),
  value_cents       integer check (value_cents is null or value_cents >= 0),
  currency          char(3) check (currency is null or currency = 'EUR'),
  -- HMAC-SHA256 der Bestellnummer mit APP_TOKEN_SECRET, gekürzt (nur bei purchase)
  order_number_hash text,
  -- granted: mindestens ein Marketing-Dienst eingewilligt; denied: keine Einwilligung;
  -- unknown: Event ohne Browser-Anfrage (Webhook, Job), Einwilligung noch nicht zugeordnet
  consent_state     text not null default 'unknown' check (consent_state in ('granted', 'denied', 'unknown')),
  consent_vendors   text[] not null default '{}'::text[]
                      check (consent_vendors <@ array['meta', 'google', 'tiktok']::text[]),
  consent_version   text,
  -- Später: Versandstatus je Anbieter, zum Beispiel {"meta": "2026-11-01T10:00:00Z"}
  sent_to           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint tracking_events_event_id_key unique (event_id)
);

create index if not exists tracking_events_created_idx
  on public.tracking_events (created_at desc);
create index if not exists tracking_events_name_idx
  on public.tracking_events (event_name, created_at desc);

alter table public.tracking_events enable row level security;
revoke all on table public.tracking_events from anon, authenticated;

comment on table public.tracking_events is
  'Serverseitiges Tracking-Protokoll (Vorbereitung Conversions API). Kein Versand an Anbieter bis zur Freigabe. Nur service_role.';
