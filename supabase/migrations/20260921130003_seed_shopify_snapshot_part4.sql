-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...
-- Teil 4 von 6

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('d5ad031b-a36e-54ce-a1b5-b2f88b947ed1', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'seed/images/UntitledProject-illustrationImage_22.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/UntitledProject-illustrationImage_22.jpg', 5454, 3600, '{"de":"Founder Bundle I, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('122b53f3-29ea-5e6d-a193-9c9fd93fb4e4', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'seed/images/Gemini_Generated_Image_oygj7doygj7doygj_17570fd0-169a-4415-8ac0-1d0d90a8c634.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Gemini_Generated_Image_oygj7doygj7doygj_17570fd0-169a-4415-8ac0-1d0d90a8c634.png', 1824, 2294, '{"de":"Founder Bundle I, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('f24689e0-8431-5c83-aef7-b61f507da6e3', 'provibe-eistee-mixed', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854820872519, 3, '2026-06-14T00:06:24+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('f24689e0-8431-5c83-aef7-b61f507da6e3', 'de', 'provibe Eistee mixed', 'Alle drei Sorten in einem Paket', '<p data-start="18" data-end="255">Du kannst dich nicht für eine Sorte entscheiden? Dann ist das <strong data-start="80" data-end="96">Mixed Bundle</strong> genau das Richtige für dich. Es vereint alle provibe Sorten in einem Paket und bietet die perfekte Möglichkeit, die gesamte Geschmacksvielfalt kennenzulernen.</p>
<p data-start="257" data-end="495">Jede Sorte ist zu gleichen Teilen enthalten, sodass du ausgewogen durchprobieren und für jeden Moment den passenden Geschmack finden kannst. Ob fruchtig-spritzig, erfrischend oder beerig – mit dem Mixed Bundle ist für Abwechslung gesorgt.</p>
<p data-start="497" data-end="654">Erhältlich in verschiedenen Paketgrößen und ideal für alle, die ihre Lieblingssorte noch suchen oder einfach die ganze Vielfalt von provibe genießen möchten.</p>
<p data-start="497" data-end="654"> </p>
<p data-start="497" data-end="654"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'provibe Eistee mixed: Eistee mit 15 g Protein', 'Du kannst dich nicht für eine Sorte entscheiden? Dann ist das Mixed Bundle genau das Richtige für dich. Es vereint alle provibe Sorten in einem Paket und b', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p><strong>Wildberry:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus schwarzem Johannisbeersaftkonzentrat, 1,6 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Heidelbeere), Süßungsmittel (Sucralose).</p><p><strong>Raspberry-Lime:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3,8 % Himbeersaft aus Himbeersaftkonzentrat, 3,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Süßkartoffel, Rettich und Apfel), Süßungsmittel (Sucralose).</p><p><strong>Peach:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3 % Pfirsichsaft aus Pfirsichsaftkonzentrat, 1,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Saflor), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","variants":{"wildberry":{"per":"100 ml","energy_kj":91,"energy_kcal":22,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"},"raspberry-lime":{"per":"100 ml","energy_kj":86,"energy_kcal":20,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"},"peach":{"per":"100 ml","energy_kj":89,"energy_kcal":21,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}}}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_options (id, product_id, name, position, values) values ('4e1fd901-6b34-5b28-a4c8-ef33295066cd', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c215c17c-7375-5083-ac05-1dc0c8f6e940', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-09', null, '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149677154631)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c215c17c-7375-5083-ac05-1dc0c8f6e940', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('146d46ed-7af9-5967-a140-2d9847109fac', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149677187399)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('146d46ed-7af9-5967-a140-2d9847109fac', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('ce93647c-8df8-54a6-ae0b-3d99f46cbe44', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149677220167)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('ce93647c-8df8-54a6-ae0b-3d99f46cbe44', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('1d9aeea2-5295-5430-a6de-8e836e06a1ee', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149677252935)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('1d9aeea2-5295-5430-a6de-8e836e06a1ee', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('67d74f80-357b-59ef-ad98-9e9a9a36daa6', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149677285703)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('67d74f80-357b-59ef-ad98-9e9a9a36daa6', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('ced977b0-851c-5487-a09e-fa40b65313b4', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149677318471)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('ced977b0-851c-5487-a09e-fa40b65313b4', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('785e1ddf-8aaa-5dff-ae64-52320281aa08', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-20.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-20.png', 4738, 3702, '{"de":"provibe Eistee mixed, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('ec3564e3-c30a-5b69-a61d-022306abc955', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-8.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-8.png', 1029, 868, '{"de":"provibe Eistee mixed, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('c58352bd-fafb-5f22-a0a1-dc8202ab5bc5', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 1853, 1405, '{"de":"provibe Eistee mixed, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('6379f363-aeae-53ab-a5db-74861fad01e6', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-6.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-6.png', 1517, 1200, '{"de":"provibe Eistee mixed, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'provibe-clear-cup', 'draft', 'simple', 'provibe', 'Merchandise', array['merch']::text[], false, 0, 'Stück', null, 'piece', 'piece', 150, '{}'::jsonb, 10854814155079, 4, '2026-06-14T00:03:07+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'de', 'provibe clear cup', null, null, '3–5 Werktage', 'provibe clear cup', null, null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('51ba586a-1988-5cb2-a232-d45e3453adf9', '557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'PV-CUP', null, 'Standard', '{}'::jsonb, 0, 1990, null, 'none', 1, 150, 100, 54149661983047)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('51ba586a-1988-5cb2-a232-d45e3453adf9', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('14ecbef5-428d-5277-a4b6-5d928b69c531', '557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'seed/images/Gemini_Generated_Image_oygj7doygj7doygj.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Gemini_Generated_Image_oygj7doygj7doygj.png', 1824, 2294, '{"de":"provibe clear cup, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('8415a344-72aa-5871-afa5-4b70f754760a', 'provibe-shirt', 'draft', 'simple', 'provibe', 'Merchandise', array['merch']::text[], false, 0, 'Stück', null, 'piece', 'piece', 200, '{}'::jsonb, 10854810485063, 5, '2026-06-14T00:01:26+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('8415a344-72aa-5871-afa5-4b70f754760a', 'de', 'provibe shirt', null, null, '3–5 Werktage', 'provibe shirt', null, null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_options (id, product_id, name, position, values) values ('6fb25519-62cd-583c-aa95-e60c585cc949', '8415a344-72aa-5871-afa5-4b70f754760a', 'Größe', 0, array['S','M','L']::text[]) on conflict (product_id, name) do update set values = excluded.values;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-S', null, 'S', '{"Größe":"S"}'::jsonb, 0, 2990, null, 'none', 1, 200, 100, 54149657985351)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c2072d06-de41-5507-a442-997148729c01', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-M', null, 'M', '{"Größe":"M"}'::jsonb, 1, 2990, null, 'none', 1, 200, 100, 54149658018119)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c2072d06-de41-5507-a442-997148729c01', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-L', null, 'L', '{"Größe":"L"}'::jsonb, 2, 2990, null, 'none', 1, 200, 100, 54149658050887)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a96ed990-d64d-5c16-a1af-40dda084584f', '8415a344-72aa-5871-afa5-4b70f754760a', 'seed/images/Screenshot2026-06-1215.11.55.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Screenshot2026-06-1215.11.55.png', 1838, 665, '{"de":"provibe shirt, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('a80bbf48-a552-5164-a1df-067f05890b9e', 'raspberry-lime', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854789284167, 6, '2026-06-13T23:50:10+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('a80bbf48-a552-5164-a1df-067f05890b9e', 'de', 'Raspberry-Lime Eistee', 'Fruchtig-spritzig mit Limette', '<p data-start="0" data-end="296"><strong data-start="0" data-end="18">Raspberry Lime</strong> vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis. Die perfekt ausbalancierte Kombination aus süß und säuerlich sorgt für einen erfrischenden Genuss, der weder zu schwer noch zu intensiv wirkt.</p>
<p data-start="298" data-end="580">Mit seinem belebenden Frischekick ist Raspberry Lime der ideale Begleiter für warme Sommertage, entspannte Momente mit Freunden oder einfach für alle, die sich eine fruchtig-erfrischende Auszeit gönnen möchten. Jeder Schluck bringt die Leichtigkeit des Sommers direkt zu dir.</p>
<p data-start="298" data-end="580"> </p>
<p data-start="298" data-end="580"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Raspberry-Lime Eistee: Eistee mit 15 g Protein', 'Raspberry Lime vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis. Die p', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3,8 % Himbeersaft aus Himbeersaftkonzentrat, 3,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Süßkartoffel, Rettich und Apfel), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":86,"energy_kcal":20,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_options (id, product_id, name, position, values) values ('c7146dfe-25e3-5074-aad3-4d23f0c3d16e', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('587f3e0f-4f96-5605-a597-f3ff89cf8e8d', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-09', null, '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149605359943)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('587f3e0f-4f96-5605-a597-f3ff89cf8e8d', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('a1ee699c-414d-5f2b-a88d-ad840e5e60a5', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149605392711)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('a1ee699c-414d-5f2b-a88d-ad840e5e60a5', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('130e9fd9-3da1-58da-a177-8f741e18dbe0', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149605425479)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('130e9fd9-3da1-58da-a177-8f741e18dbe0', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('6f97148c-c6e9-5a15-a198-9dbb3b738794', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149605458247)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('6f97148c-c6e9-5a15-a198-9dbb3b738794', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('309deb13-a55e-58f1-a1e5-f885c6fdc3e5', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149605491015)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('309deb13-a55e-58f1-a1e5-f885c6fdc3e5', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('1efba969-103f-5931-ac68-3ac7d83b2cc2', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149605523783)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('1efba969-103f-5931-ac68-3ac7d83b2cc2', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('f91a117e-0d33-5271-a76b-e46422d25167', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage-8.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-8.png', 1029, 868, '{"de":"Raspberry-Lime Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('82526963-c264-5381-a82f-3243a974c363', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage_17.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_17.jpg', 3261, 4032, '{"de":"Raspberry-Lime Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('7a9e4853-5bf0-53f7-a1c1-974d538a090a', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage-13.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-13.png', 2742, 2742, '{"de":"Raspberry-Lime Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
