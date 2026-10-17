-- 2042 Backoffice Inhalte: Veröffentlichungsdaten für Rechtstexte und Seiten
--
-- Inhalt:
--   1. legal_document_versions.published_at, published_by: Zeitpunkt und Person der Freigabe.
--      effective_from bleibt "gültig ab". Alte Versionen bleiben unverändert erhalten (Nachweis,
--      welche Fassung bei einer Bestellung galt, orders.legal_versions).
--      Backfill: bereits veröffentlichte Versionen erhalten published_at = coalesce(effective_from, created_at).
--   2. pages.published_at
--   3. Schutz: eine veröffentlichte Rechtstext-Version darf inhaltlich nicht mehr geändert werden
--      (Trigger, greift auch für Staff über die API). Neue Fassung = neue Version.
--
-- Idempotent: add column if not exists, create or replace, drop trigger if exists.
--
-- Rückweg (manuell):
--   drop trigger if exists legal_versions_immutable on public.legal_document_versions;
--   drop function if exists public.guard_published_legal_version();
--   alter table public.pages drop column if exists published_at;
--   alter table public.legal_document_versions drop column if exists published_at, drop column if exists published_by;

alter table public.legal_document_versions add column if not exists published_at timestamptz;
alter table public.legal_document_versions add column if not exists published_by uuid;
update public.legal_document_versions
   set published_at = coalesce(effective_from, created_at)
 where status = 'published' and published_at is null;

alter table public.pages add column if not exists published_at timestamptz;
update public.pages set published_at = updated_at where status = 'published' and published_at is null;

create or replace function public.guard_published_legal_version()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if old.status = 'published' and (
       new.body_html is distinct from old.body_html
    or new.title is distinct from old.title
    or new.version is distinct from old.version
    or new.locale is distinct from old.locale
    or new.document_id is distinct from old.document_id) then
    raise exception 'Veröffentlichte Rechtstext-Versionen sind unveränderlich, lege eine neue Version an'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists legal_versions_immutable on public.legal_document_versions;
create trigger legal_versions_immutable
before update on public.legal_document_versions
for each row execute function public.guard_published_legal_version();

revoke execute on function public.guard_published_legal_version() from public, anon;
