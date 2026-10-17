-- 2070 Backoffice CRM (Welle 2, Paket W2-C): Indizes für die Modulseiten
--
-- Inhalt (nur Indizes, keine Daten- oder Rechteänderung):
--   1. webhook_events: Resend-Ereignisse je Nachricht (Versandprotokoll, Drawer "Resend-Ereignisse")
--   2. automation_runs: letzte Läufe je Automation (Seite /admin/automationen)
--   3. contact_messages, withdrawal_requests, leads: Listen nach Status und Eingang (/admin/leads)
--   4. newsletter_contacts: Liste nach Eingang (/admin/newsletter, Tab Kontakte)
--
-- Idempotent: create index if not exists.
--
-- Rückweg (manuell):
--   drop index if exists public.webhook_events_resend_email_idx;
--   drop index if exists public.automation_runs_created_idx;
--   drop index if exists public.contact_messages_status_created_idx;
--   drop index if exists public.withdrawal_requests_status_created_idx;
--   drop index if exists public.leads_status_created_idx;
--   drop index if exists public.newsletter_contacts_created_idx;

create index if not exists webhook_events_resend_email_idx
  on public.webhook_events ((payload -> 'data' ->> 'email_id'))
  where provider = 'resend';

create index if not exists automation_runs_created_idx
  on public.automation_runs (automation_key, created_at desc);

create index if not exists contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

create index if not exists withdrawal_requests_status_created_idx
  on public.withdrawal_requests (status, created_at desc);

create index if not exists leads_status_created_idx
  on public.leads (status, created_at desc);

create index if not exists newsletter_contacts_created_idx
  on public.newsletter_contacts (created_at desc);
