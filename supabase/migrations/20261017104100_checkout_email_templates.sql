-- Checkout 1041: Übersicht der transaktionalen Vorlagen aus dem Checkout fürs Backoffice.
-- Der Inhalt der Mails liegt im Code (src/lib/checkout/emails.ts), die Tabelle dient nur der
-- Anzeige und dem An- und Abschalten. Idempotent über on conflict.
--
-- Rückweg:
--   delete from public.email_templates
--   where key in ('order_confirmation', 'payment_confirmation', 'order_internal_notification');

insert into public.email_templates (key, name, description, category, subject_template, preview_props, is_enabled)
values
  ('order_confirmation', 'Bestellbestätigung',
   'Geht unmittelbar nach der Zahlung raus. Enthält die Bestellübersicht sowie AGB und Widerrufsbelehrung in Textform (§ 312f BGB).',
   'transactional', 'Deine Bestellung {{order_number}} bei provibe',
   '{"order_number":"PV-10001"}'::jsonb, true),
  ('payment_confirmation', 'Zahlungsbestätigung',
   'Bestätigt den Zahlungseingang mit Betrag und Zahlart.',
   'transactional', 'Zahlung erhalten: {{order_number}}',
   '{"order_number":"PV-10001"}'::jsonb, true),
  ('order_internal_notification', 'Neue Bestellung (intern)',
   'Benachrichtigung an hello@provibe-drinks.de bei jeder neuen Bestellung.',
   'internal', 'Neue Bestellung {{order_number}} über {{total}}',
   '{"order_number":"PV-10001","total":"61,90 €"}'::jsonb, true)
on conflict (key) do nothing;
