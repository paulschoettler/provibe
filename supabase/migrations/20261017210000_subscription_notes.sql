-- 2100 Backoffice Abos: interne Notizen am Abo
--
-- Inhalt:
--   1. subscription_notes: Notizen des Teams zu einem Abo (Support, Admin, Owner schreiben im
--      Abo-Detail /admin/abos/[id]). Nur intern, nie für Kunden sichtbar.
--   2. RLS aktiv und erzwungen, keine Policies: Zugriff ausschließlich über die Service-Role
--      (Server Actions mit requireStaff und PERMISSIONS.viewCustomers). anon und authenticated
--      bekommen keine Rechte.
--
-- author_id zeigt auf staff_users; wird ein Teammitglied gelöscht, bleibt die Notiz ohne Autor
-- erhalten (on delete set null). Wird ein Abo gelöscht, gehen seine Notizen mit (cascade).
--
-- Idempotent: create table if not exists, create index if not exists, RLS und Rechte erneut setzbar.
--
-- Rückweg (manuell):
--   drop table if exists public.subscription_notes;

create table if not exists public.subscription_notes (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  author_id       uuid references public.staff_users (user_id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at      timestamptz not null default now()
);

create index if not exists subscription_notes_subscription_idx
  on public.subscription_notes (subscription_id, created_at desc);

alter table public.subscription_notes enable row level security;
alter table public.subscription_notes force row level security;
revoke all on public.subscription_notes from anon, authenticated;
grant all on public.subscription_notes to service_role;
