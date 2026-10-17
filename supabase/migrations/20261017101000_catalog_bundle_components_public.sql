-- Katalog (Paket Katalog, 17.10.2026): Bundle-Komponenten für die Storefront lesbar machen.
--
-- Hintergrund: Die Komponenten der Founder Bundles sind bewusst inaktive Varianten
-- ("1 Dose (Bundle-Komponente)", is_active = false). Die Policy public_read auf
-- product_variants blendet sie für anon aus. Dadurch lieferte bundle_components_sum_cents
-- (SECURITY INVOKER) für anon nur den Preis von Becher bzw. Shirt, zum Beispiel 19,90 € statt
-- 37,30 € für Founder Bundle I, und die Zeile "Einzeln: X €" (Entscheidung B4/H12) blieb leer.
--
-- Lösung: zwei SECURITY-DEFINER-Funktionen, die nur Daten zu Bundles aktiver Produkte
-- herausgeben (Staff und Service-Role sehen alle). Sie geben ausschließlich Preis, Menge und
-- Bezeichnungen zurück, keine Bestände und keine internen Felder. Die Tabellen bleiben
-- unverändert, die Policies auch.
--
-- Idempotent (create or replace). Rückweg:
--   drop function if exists public.bundle_components_public(uuid, text);
--   create or replace function public.bundle_components_sum_cents(p_bundle_variant_id uuid)
--   returns integer language sql stable set search_path = public, extensions as $$
--     select coalesce(sum(c.quantity * v.price_cents), 0)::integer
--     from public.bundle_components c join public.product_variants v on v.id = c.component_variant_id
--     where c.bundle_variant_id = p_bundle_variant_id;
--   $$;
--   alter function public.bundle_components_sum_cents(uuid) security invoker;

-- 1. Summe der Komponentenpreise ("Einzeln: X €"), jetzt auch für anon korrekt
create or replace function public.bundle_components_sum_cents(p_bundle_variant_id uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(sum(c.quantity * v.price_cents), 0)::integer
  from public.bundle_components c
  join public.product_variants v on v.id = c.component_variant_id
  join public.product_variants b on b.id = c.bundle_variant_id
  join public.products bp on bp.id = b.product_id
  where c.bundle_variant_id = p_bundle_variant_id
    and (bp.status = 'active' or auth.role() = 'service_role' or public.is_staff());
$$;

-- 2. Komponentenliste je Bundle-Variante für die Produktseite (Mengen, Titel, Preise, Pfand)
create or replace function public.bundle_components_public(p_bundle_variant_id uuid, p_locale text default 'de')
returns table (
  component_variant_id uuid,
  quantity integer,
  product_handle text,
  product_title text,
  product_tags text[],
  variant_title text,
  option_values jsonb,
  unit_count integer,
  price_cents integer,
  deposit_cents_per_unit integer
)
language sql stable security definer set search_path = public, extensions as $$
  select c.component_variant_id,
         c.quantity,
         cp.handle,
         coalesce(t.title, cp.handle),
         cp.tags,
         v.title,
         v.option_values,
         v.unit_count,
         v.price_cents,
         cp.deposit_cents_per_unit
  from public.bundle_components c
  join public.product_variants b on b.id = c.bundle_variant_id
  join public.products bp on bp.id = b.product_id
  join public.product_variants v on v.id = c.component_variant_id
  join public.products cp on cp.id = v.product_id
  left join public.product_translations t on t.product_id = cp.id and t.locale = p_locale
  where c.bundle_variant_id = p_bundle_variant_id
    and (bp.status = 'active' or auth.role() = 'service_role' or public.is_staff())
  order by cp.position desc, cp.handle;
$$;

revoke all on function public.bundle_components_public(uuid, text) from public;
grant execute on function public.bundle_components_public(uuid, text) to anon, authenticated, service_role;
grant execute on function public.bundle_components_sum_cents(uuid) to anon, authenticated, service_role;

-- 3. Kollektionstexte: Titel "Alle Produkte" für die automatische Gesamtliste und kurze
--    Beschreibungen, nur wo noch keine gepflegt ist (im Backoffice jederzeit überschreibbar).
update public.collection_translations t
   set title = 'Alle Produkte'
  from public.collections c
 where c.id = t.collection_id and c.handle = 'all' and t.locale = 'de' and t.title = 'Produkte';

update public.collection_translations t
   set description_html = d.description
  from public.collections c
  join (values
    ('all', '<p>Eistee, Founder Bundles und Merch. Alles, was provibe gerade hat.</p>'),
    ('alle-produkte', '<p>Unsere Sorten, der Mix und die Founder Bundles auf einen Blick.</p>'),
    ('eistee', '<p>Eistee mit 15 g Protein, ohne Zucker. Wildberry, Raspberry Lime, Peach und der Mix aus allen dreien.</p>'),
    ('aktion', '<p>Limitierte Sets mit allen drei Sorten, Becher und Shirt.</p>')
  ) as d(handle, description) on d.handle = c.handle
 where c.id = t.collection_id and t.locale = 'de' and t.description_html is null;
