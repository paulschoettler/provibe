-- Bewertungen, Storefront-Teil (Paket Bewertungen, 17.10.2026)
--
-- Das Schema aus 20260921121100 (public.reviews) reicht für das Modell: order_id, order_item_id,
-- product_id, customer_id, rating 1..5, title, body, author_name, status pending/approved/rejected,
-- is_verified_purchase, token_hash, reply_body (Antwort des Shops), moderated_by/_at, created_at.
-- Diese Migration ergänzt nur Indizes, die Eindeutigkeit je Bestellung und Produkt und schränkt
-- die Spalten ein, die anon lesen darf.
--
--   1. automation_runs.token_hash (identisch zu 20261017204100, hier nur, damit der Index unten
--      auch dann angelegt werden kann, wenn diese Migration vor der CRM-Migration läuft)
--   2. Index auf automation_runs.token_hash (Prüfung des Bewertungslinks)
--   3. Eindeutig: höchstens eine Bewertung je Bestellung und Produkt
--   4. Index für die Produktseite: freigegebene Bewertungen je Produkt, neueste zuerst
--   5. anon liest nur öffentliche Spalten (keine order_id, order_item_id, customer_id, token_hash,
--      moderated_by). Die Policy public_read (status = 'approved') bleibt unverändert.
--
-- Idempotent. Rückweg:
--   drop index if exists public.reviews_product_approved_idx;
--   drop index if exists public.reviews_order_product_uidx;
--   drop index if exists public.automation_runs_token_hash_idx;
--   grant select on public.reviews to anon;
--   (token_hash nicht entfernen, die Spalte gehört zur CRM-Migration 20261017204100)

-- 1
alter table public.automation_runs add column if not exists token_hash text;

-- 2
create index if not exists automation_runs_token_hash_idx
  on public.automation_runs (token_hash)
  where token_hash is not null;

-- 3
create unique index if not exists reviews_order_product_uidx
  on public.reviews (order_id, product_id)
  where order_id is not null;

-- 4
create index if not exists reviews_product_approved_idx
  on public.reviews (product_id, created_at desc)
  where status = 'approved';

-- 5
revoke select on public.reviews from anon;
grant select (id, product_id, author_name, rating, title, body, status, is_verified_purchase,
              reply_body, created_at)
  on public.reviews to anon;

comment on column public.reviews.token_hash is
  'SHA-256 (hex) des Bewertungslinks, mit dem die Bewertung zuletzt gespeichert wurde (gleich automation_runs.token_hash)';
comment on column public.reviews.reply_body is
  'Öffentliche Antwort des Shops, erscheint unter der Bewertung auf der Produktseite';
