-- Preisangaben (H22, § 7 PAngV): Der alte Shopify-Satz "Pfand bereits im Preis inkl. (0,25€ pro Dose)"
-- widerspricht der getrennten Pfandanzeige. Er wird aus den Produktbeschreibungen entfernt.
-- Idempotent (regexp_replace ohne Treffer ändert nichts). Rückweg: Satz im Backoffice wieder einfügen
-- oder aus supabase/migrations/20260921130002_seed_shopify_snapshot_part3.sql übernehmen.
update public.product_translations
   set description_html = regexp_replace(
         description_html,
         '<p[^>]*>\s*<strong>\s*Pfand bereits im Preis inkl\.\s*\(0,25\s*€\s*pro Dose\)\s*</strong>\s*</p>',
         '', 'gi')
 where description_html ~* 'Pfand bereits im Preis inkl';
