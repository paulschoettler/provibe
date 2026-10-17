-- 2011 Admin-Shell: Indizes für die Protokoll-Liste (/admin/protokoll)
--
-- Die Liste sortiert nach created_at und filtert nach Aktion, Entität, Benutzer und Zeitraum.
-- Vorhanden sind (entity_type, entity_id, created_at) und (actor_user_id, created_at).
--
-- Rückweg:
--   drop index if exists public.audit_log_created_idx;
--   drop index if exists public.audit_log_action_idx;

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);
