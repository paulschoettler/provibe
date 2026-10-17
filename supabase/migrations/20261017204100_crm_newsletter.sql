-- 2041 Backoffice CRM: Newsletter-Abmeldetoken, Kampagnen-Felder, Empfängerstatus, Automations-Token
--
-- Inhalt:
--   1. newsletter_contacts.unsubscribe_token: zufälliges Token je Kontakt für den Abmeldelink
--      (/newsletter/abmelden?token=...) und List-Unsubscribe (One-Click, RFC 8058). Das Token erlaubt
--      nur das Abmelden, deshalb liegt es im Klartext vor (der Link muss in jeder Mail neu entstehen).
--   2. newsletter_campaigns.reply_to, test_sent_at
--   3. campaign_recipients: delivered_at, complained_at, error, created_at, Index auf provider_message_id
--   4. automation_runs.token_hash (Bewertungslink der Bewertungsanfrage, nur Hash)
--   5. Indizes für das Versandprotokoll (email_messages nach Kampagne, Kunde, Status)
--
-- Idempotent: add column if not exists, create index if not exists, Backfill nur für leere Tokens.
--
-- Rückweg (manuell):
--   drop index if exists public.email_messages_campaign_idx, public.email_messages_customer_idx,
--     public.email_messages_status_idx, public.campaign_recipients_message_idx,
--     public.campaign_recipients_status_idx, public.newsletter_contacts_unsubscribe_token_key;
--   alter table public.automation_runs drop column if exists token_hash;
--   alter table public.campaign_recipients drop column if exists delivered_at, drop column if exists complained_at,
--     drop column if exists error, drop column if exists created_at;
--   alter table public.newsletter_campaigns drop column if exists reply_to, drop column if exists test_sent_at;
--   alter table public.newsletter_contacts drop column if exists unsubscribe_token;

-- 1. Abmeldetoken -------------------------------------------------------------------
alter table public.newsletter_contacts add column if not exists unsubscribe_token text;
update public.newsletter_contacts set unsubscribe_token = public.random_token(24) where unsubscribe_token is null;
alter table public.newsletter_contacts alter column unsubscribe_token set default public.random_token(24);
alter table public.newsletter_contacts alter column unsubscribe_token set not null;
create unique index if not exists newsletter_contacts_unsubscribe_token_key
  on public.newsletter_contacts (unsubscribe_token);

-- 2. Kampagnen ---------------------------------------------------------------------
alter table public.newsletter_campaigns add column if not exists reply_to text;
alter table public.newsletter_campaigns add column if not exists test_sent_at timestamptz;

-- 3. Empfänger ---------------------------------------------------------------------
alter table public.campaign_recipients add column if not exists delivered_at timestamptz;
alter table public.campaign_recipients add column if not exists complained_at timestamptz;
alter table public.campaign_recipients add column if not exists error text;
alter table public.campaign_recipients add column if not exists created_at timestamptz not null default now();
create index if not exists campaign_recipients_message_idx on public.campaign_recipients (provider_message_id)
  where provider_message_id is not null;
create index if not exists campaign_recipients_status_idx on public.campaign_recipients (campaign_id, status);

-- 4. Automationen ------------------------------------------------------------------
alter table public.automation_runs add column if not exists token_hash text;
create index if not exists automation_runs_status_idx on public.automation_runs (automation_key, status, sent_at desc);

-- 5. Versandprotokoll --------------------------------------------------------------
create index if not exists email_messages_campaign_idx on public.email_messages (campaign_id) where campaign_id is not null;
create index if not exists email_messages_customer_idx on public.email_messages (customer_id, created_at desc) where customer_id is not null;
create index if not exists email_messages_status_idx on public.email_messages (status, created_at desc);
create index if not exists email_messages_created_idx on public.email_messages (created_at desc);
