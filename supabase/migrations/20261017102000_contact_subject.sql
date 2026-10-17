-- Paket Inhalte: Betreff im Kontaktformular (/pages/contact, Figma 26:3077)
-- Das Formular fragt einen Betreff ab (Bestellung, Produkt, Partnerschaft, Sonstiges).
-- Bis diese Migration live ist, schreibt die Server Action den Betreff als erste Zeile
-- in message (Rückfall in src/lib/forms/contact.ts).
--
-- Vorwärtskompatibel: neue, optionale Spalte, bestehende Zeilen bleiben gültig.
-- Rückweg: alter table public.contact_messages drop column if exists subject;

alter table public.contact_messages
  add column if not exists subject text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_subject_length'
  ) then
    alter table public.contact_messages
      add constraint contact_messages_subject_length check (subject is null or char_length(subject) <= 80);
  end if;
end $$;

comment on column public.contact_messages.subject is
  'Betreff aus dem Kontaktformular (Anzeigetext, zum Beispiel "Bestellung")';
