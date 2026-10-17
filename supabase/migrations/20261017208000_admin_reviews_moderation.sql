-- 2080 Backoffice Bewertungen: Moderation mit Grund, Antwort des Shops mit Zeitstempel
--
-- Inhalt:
--   1. reviews.rejection_reason: Pflichtgrund beim Ablehnen (UWG: negative Bewertungen nur bei
--      Regelverstoß ablehnen, der Grund wird zusätzlich im Audit-Log protokolliert)
--   2. reviews.reply_at, reviews.reply_by: wann und von wem die Antwort des Shops stammt
--      (reply_body gibt es schon seit 20260921121100)
--   3. Index für die Moderationsliste (Status, Eingang)
--
-- Keine Änderung an RLS: public_read zeigt weiter nur status = 'approved', das Backoffice
-- arbeitet mit der Service-Role. Löschen auf Kundenwunsch ist ein DELETE der einzelnen Zeile.
--
-- Idempotent: add column if not exists, create index if not exists.
--
-- Rückweg (manuell):
--   drop index if exists public.reviews_status_created_idx;
--   alter table public.reviews drop column if exists rejection_reason,
--     drop column if exists reply_at, drop column if exists reply_by;

alter table public.reviews add column if not exists rejection_reason text;
alter table public.reviews add column if not exists reply_at timestamptz;
alter table public.reviews add column if not exists reply_by uuid;

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);
