-- 2043 Backoffice CRM: Vorlagenübersicht (Newsletter, Automationen, Konto) und Automations-Konfiguration
--
-- email_templates dient nur der Anzeige im Backoffice (/admin/emails) und dem An- und Abschalten.
-- Der Inhalt der Mails liegt im Code: src/emails/* (CRM), src/lib/checkout/emails.ts (Checkout),
-- src/lib/auth/mails.ts (Konto), Supabase Auth (Magic Link, Passwort zurücksetzen).
--
-- automations: Vorlage, Verzögerung und Pflicht zur Werbeeinwilligung je Automation.
-- Warenkorbabbrecher frühestens nach 24 Stunden, nur mit Werbeeinwilligung.
-- Bewertungsanfrage laut H20 nur mit Werbeeinwilligung und standardmäßig aus (is_enabled bleibt false).
--
-- Idempotent: on conflict do nothing, config wird nur um fehlende Schlüssel ergänzt.
--
-- Rückweg:
--   delete from public.email_templates where key in ('newsletter_campaign', 'newsletter_welcome',
--     'abandoned_cart', 'review_request', 'newsletter_double_opt_in', 'account_activate',
--     'account_email_changed', 'account_deleted', 'auth_magic_link', 'auth_password_reset');
--   update public.automations set config = config - 'template' - 'max_age_days' where key in
--     ('welcome', 'abandoned_cart', 'review_request');

insert into public.email_templates (key, name, description, category, subject_template, preview_props, is_enabled)
values
  ('newsletter_campaign', 'Newsletter-Kampagne',
   'Brand-Vorlage für Kampagnen aus dem Block-Editor mit Abmeldelink und Impressum.',
   'marketing', '{{subject}}', '{"subject":"Peach ist zurück"}'::jsonb, true),
  ('newsletter_welcome', 'Willkommen nach Opt-in',
   'Automation: geht nach bestätigtem Double Opt-in raus.',
   'marketing', 'Willkommen bei provibe', '{"first_name":"Paul"}'::jsonb, true),
  ('abandoned_cart', 'Warenkorb erinnern',
   'Automation: frühestens 24 Stunden nach der letzten Aktivität, nur mit Werbeeinwilligung.',
   'marketing', 'Dein Warenkorb wartet noch', '{"first_name":"Paul"}'::jsonb, true),
  ('review_request', 'Bewertungsanfrage',
   'Automation: nach der Zustellung, nur mit Werbeeinwilligung (H20), standardmäßig aus.',
   'marketing', 'Wie schmeckt dir dein provibe?', '{"order_number":"PV-10001"}'::jsonb, true),
  ('newsletter_double_opt_in', 'Double Opt-in',
   'Bestätigungslink für die Newsletter-Anmeldung (Footer, Checkout, Konto).',
   'auth', 'Bitte bestätige deine Anmeldung', '{}'::jsonb, true),
  ('account_activate', 'Konto aktivieren',
   'Aktivierungslink für Bestandskunden aus Shopify ohne Login.',
   'auth', 'Dein provibe Konto ist bereit', '{"first_name":"Paul"}'::jsonb, true),
  ('account_email_changed', 'E-Mail-Adresse geändert',
   'Hinweis an die alte Adresse nach bestätigtem Wechsel.',
   'auth', 'Deine E-Mail-Adresse wurde geändert', '{}'::jsonb, true),
  ('account_deleted', 'Konto gelöscht',
   'Bestätigung der Kontolöschung mit Hinweis auf Aufbewahrungsfristen.',
   'transactional', 'Dein provibe Konto wurde gelöscht', '{}'::jsonb, true),
  ('auth_magic_link', 'Magic Link',
   'Login-Link, versendet von Supabase Auth (Vorlage im Supabase-Dashboard).',
   'auth', 'Dein Login-Link', '{}'::jsonb, true),
  ('auth_password_reset', 'Passwort zurücksetzen',
   'Link zum Zurücksetzen, versendet von Supabase Auth (Vorlage im Supabase-Dashboard).',
   'auth', 'Passwort zurücksetzen', '{}'::jsonb, true)
on conflict (key) do nothing;

update public.automations
   set config = jsonb_build_object('template', 'newsletter_welcome') || config
 where key = 'welcome' and not (config ? 'template');

update public.automations
   set config = jsonb_build_object('template', 'abandoned_cart', 'max_age_days', 7,
                                   'requires_marketing_consent', true) || config
 where key = 'abandoned_cart' and not (config ? 'template');

update public.automations
   set config = jsonb_build_object('template', 'review_request', 'requires_marketing_consent', true) || config
 where key = 'review_request' and not (config ? 'template');
