-- 1060 Protokoll der Shopify-Importe (scripts/import, docs/import.md)
--
-- import_runs: ein Eintrag je angewendetem Lauf (--apply) mit Art, Datei-Hash, Zahlen und Bericht.
-- import_run_items: jede angelegte oder geänderte Zeile mit Vorzustand, damit sich ein Lauf
-- gezielt zurücknehmen lässt (pnpm import:rollback -- --run <id>). Probeläufe schreiben nichts.
--
-- Zugriff: Lesen für Staff (Backoffice), Schreiben nur über die Importskripte (Datenbank-Eigentümer
-- beziehungsweise Service Role). Das Feld result kann E-Mail-Adressen aus Fehlerzeilen enthalten,
-- deshalb kein anon-Zugriff.
--
-- Rückweg (manuell, nur wenn keine Importe mehr nachvollzogen werden müssen):
--   drop table if exists public.import_run_items;
--   drop table if exists public.import_runs;

create table if not exists public.import_runs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('customers', 'orders', 'discounts', 'newsletter')),
  status          text not null default 'running'
                  check (status in ('running', 'completed', 'failed', 'rolled_back')),
  file_name       text not null,
  file_sha256     text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  extra_files     jsonb not null default '[]'::jsonb,   -- weitere Dateien (z.B. Abonnentenliste) mit Hash
  options         jsonb not null default '{}'::jsonb,   -- Flags, Blockgröße, Ziel
  rows_total      integer not null default 0,           -- Dateizeilen ohne Kopfzeile
  created_count   integer not null default 0,
  updated_count   integer not null default 0,
  unchanged_count integer not null default 0,
  skipped_count   integer not null default 0,
  error_count     integer not null default 0,
  result          jsonb not null default '{}'::jsonb,   -- Bericht: Fehler je Zeile mit Grund, Hinweise, Zusatzzahlen
  started_by      text,                                 -- Systembenutzer und Rechner des Laufs
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  rolled_back_at  timestamptz,
  rollback_result jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists import_runs_kind_idx on public.import_runs (kind, started_at desc);
create index if not exists import_runs_hash_idx on public.import_runs (kind, file_sha256);

create table if not exists public.import_run_items (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.import_runs (id) on delete cascade,
  entity_type text not null check (entity_type in ('customers', 'customer_addresses', 'customer_notes',
                                                   'orders', 'discount_codes', 'newsletter_contacts')),
  entity_id   uuid not null,
  action      text not null check (action in ('created', 'updated')),
  before      jsonb,                                    -- Zeile vor der Änderung (nur bei updated)
  source_line integer,                                  -- Zeile in der Exportdatei
  created_at  timestamptz not null default now()
);
create index if not exists import_run_items_run_idx on public.import_run_items (run_id, id);
create index if not exists import_run_items_entity_idx on public.import_run_items (entity_type, entity_id);

alter table public.import_runs enable row level security;
alter table public.import_runs force row level security;
alter table public.import_run_items enable row level security;
alter table public.import_run_items force row level security;

drop policy if exists staff_select on public.import_runs;
create policy staff_select on public.import_runs for select to authenticated using (public.is_staff());
drop policy if exists staff_select on public.import_run_items;
create policy staff_select on public.import_run_items for select to authenticated using (public.is_staff());

drop trigger if exists set_updated_at on public.import_runs;
create trigger set_updated_at before update on public.import_runs
for each row execute function public.set_updated_at();

revoke all on public.import_runs, public.import_run_items from anon;
revoke insert, update, delete on public.import_runs, public.import_run_items from authenticated;
grant select on public.import_runs, public.import_run_items to authenticated;
grant all on public.import_runs, public.import_run_items to service_role;
