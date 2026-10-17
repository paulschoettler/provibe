-- Backoffice Bestellungen 2050: Indizes für die Seiten aus Welle 2 (Paket W2-A).
--
-- /admin/bestellungen blendet Testbestellungen standardmäßig aus (is_test = false) und sortiert nach
-- placed_at; /admin/bestellungen/[id] lädt Notizen und Erstattungen je Bestellung; /admin/jobs
-- filtert nach Status und sortiert nach updated_at; /admin/bestand zeigt aktive Reservierungen je
-- Variante. Keine Datenänderung, nur Indizes.
--
-- Idempotent: create index if not exists.
--
-- Rückweg:
--   drop index if exists public.orders_is_test_placed_idx;
--   drop index if exists public.order_notes_order_idx;
--   drop index if exists public.refunds_order_idx;
--   drop index if exists public.jobs_status_updated_idx;
--   drop index if exists public.inventory_reservations_variant_active_idx;

create index if not exists orders_is_test_placed_idx
  on public.orders (is_test, placed_at desc);

create index if not exists order_notes_order_idx
  on public.order_notes (order_id, created_at desc);

create index if not exists refunds_order_idx
  on public.refunds (order_id, created_at);

create index if not exists jobs_status_updated_idx
  on public.jobs (status, updated_at desc);

create index if not exists inventory_reservations_variant_active_idx
  on public.inventory_reservations (variant_id, expires_at)
  where status = 'active';
