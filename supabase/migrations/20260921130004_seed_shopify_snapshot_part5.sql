-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...
-- Teil 5 von 6

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'peach', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854784467271, 7, '2026-06-13T23:48:07+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'de', 'Peach Eistee', 'Der Klassiker: saftiger Pfirsich', '<p data-start="56" data-end="103"><strong data-start="56" data-end="103">Pfirsich-Eistee – der Klassiker von provibe</strong></p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node="">Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schwarztee. Das Ergebnis: eine ausgewogene Erfrischung mit vollem Geschmack – fruchtig, aber nicht aufdringlich, angenehm süß, aber nie zu viel. Genau die richtige Balance für alle, die einen ehrlichen, unkomplizierten Eistee genießen möchten. Ein echter Klassiker, der einfach immer passt.</p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node=""> </p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node=""><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Peach Eistee: Eistee mit 15 g Protein', 'Pfirsich-Eistee – der Klassiker von provibe Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schw', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3 % Pfirsichsaft aus Pfirsichsaftkonzentrat, 1,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Saflor), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":89,"energy_kcal":21,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_options (id, product_id, name, position, values) values ('a2223650-7498-5aa2-ac7f-514e4cc40ba1', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('2cdd6040-3969-538f-af4c-cf18246fbba1', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-09', 'PEACH', '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149574000967)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('2cdd6040-3969-538f-af4c-cf18246fbba1', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c81c79b6-6980-5a89-a43e-61faa8a16680', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149574033735)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c81c79b6-6980-5a89-a43e-61faa8a16680', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('8f14f25e-35f7-59c6-a08f-e429cdbfcab0', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149574066503)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('8f14f25e-35f7-59c6-a08f-e429cdbfcab0', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('2faf0497-c253-58df-a9d5-0457c7f6a8f4', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149574099271)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('2faf0497-c253-58df-a9d5-0457c7f6a8f4', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('d530fd55-ffb4-57f7-a6cf-1c90586391cc', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149574132039)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('d530fd55-ffb4-57f7-a6cf-1c90586391cc', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('d0d0795b-bccc-58be-a7af-dea5746f4ce4', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149574164807)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('d0d0795b-bccc-58be-a7af-dea5746f4ce4', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('94272363-c59a-5bd5-abfb-16e074d28756', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 1853, 1405, '{"de":"Peach Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('d07be6db-929b-5274-af8c-ed3a48a3cec9', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/Untitled_Project_-_illustrationImage_19.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_19.jpg', 2805, 4027, '{"de":"Peach Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('41fd87e3-2d69-523f-a456-5579c18e0a8e', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/IMG_0769_2.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0769_2.jpg', 2112, 1600, '{"de":"Peach Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('26878e37-26e0-5d79-aa17-79316fa6e250', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/Untitled_Project_-_illustrationImage-19.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-19.png', 1296, 1296, '{"de":"Peach Eistee, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'wildberry', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854668861767, 8, '2026-06-13T22:50:08+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;

insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'de', 'Wildberry Eistee', 'Beerig, vollmundig, natürlich', '<p data-start="0" data-end="330"><strong data-start="0" data-end="13">Wildberry</strong> vereint die fruchtige Vielfalt ausgewählter Beeren zu einem vollmundigen Geschmackserlebnis, das Erinnerungen an unbeschwerte Kindheitstage weckt. Die harmonische Kombination aus Johannisbeeren, Heidelbeeren und Erdbeeren sorgt für eine ausgewogene Balance zwischen fruchtiger Intensität und angenehmer Leichtigkeit.</p>
<p data-start="332" data-end="549">Das Ergebnis ist ein runder, natürlicher Beerengeschmack, der zu jeder Gelegenheit passt – erfrischend, vertraut und einfach lecker. Ein zeitloser Klassiker für alle, die den authentischen Geschmack von Beeren lieben.</p>
<p data-start="332" data-end="549"> </p>
<p data-start="332" data-end="549"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Wildberry Eistee: Eistee mit 15 g Protein', 'Wildberry vereint die fruchtige Vielfalt ausgewählter Beeren zu einem vollmundigen Geschmackserlebnis, das Erinnerungen an unbeschwerte Kindheitstage weckt', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus schwarzem Johannisbeersaftkonzentrat, 1,6 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Heidelbeere), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":91,"energy_kcal":22,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;

insert into public.product_options (id, product_id, name, position, values) values ('514d341f-0d95-52c2-a2af-cf170d37f516', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('811c1bbb-1bd4-5b5d-a74b-bd21f2577357', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-09', 'WILDBERRY-1', '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149500567879)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('811c1bbb-1bd4-5b5d-a74b-bd21f2577357', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('907ce79c-a819-5a39-a127-3c351b8dc9ea', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-12', 'WILDBERRY-2', '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149500600647)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('907ce79c-a819-5a39-a127-3c351b8dc9ea', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('e8dd15ea-4767-5d31-a28a-34c10bae9867', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-18', 'WILDBERRY-3', '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149500633415)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('e8dd15ea-4767-5d31-a28a-34c10bae9867', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c42a18b4-2bf2-5910-a886-7af572c333bc', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-24', 'WILDBERRY-4', '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149500666183)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c42a18b4-2bf2-5910-a886-7af572c333bc', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('746f87fe-fb5c-5330-aed7-37a61bfb2ef2', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-36', 'WILDBERRY-5', '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149500698951)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('746f87fe-fb5c-5330-aed7-37a61bfb2ef2', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('f51d7afe-f717-5846-aa5b-feaaac316aa2', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-48', 'WILDBERRY-6', '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149500731719)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;

insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('f51d7afe-f717-5846-aa5b-feaaac316aa2', 0, true, false) on conflict (variant_id) do nothing;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('7f28aef4-8a18-5308-a0dd-592532ad7e40', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage-6.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-6.png', 1517, 1200, '{"de":"Wildberry Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a0d44328-9347-5d62-a311-8039f3308f2f', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage_18.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_18.jpg', 2655, 3386, '{"de":"Wildberry Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('e5f4537c-ee64-536a-a556-0350f7bad4ad', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/IMG_0764_2.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0764_2.jpg', 1869, 1417, '{"de":"Wildberry Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a4f854cb-479e-557a-acd0-8839e377fe83', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage-10.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-10.png', 2048, 2048, '{"de":"Wildberry Eistee, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;

insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;

insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 0, true) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('c152685b-728e-5426-ae63-974ba7077871', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;

insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('c152685b-728e-5426-ae63-974ba7077871', 0, true) on conflict (variant_id) do nothing;

insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('d424f7bb-a1b2-521e-ae5f-bf6659c48557', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;

insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('d424f7bb-a1b2-521e-ae5f-bf6659c48557', 0, true) on conflict (variant_id) do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'c2072d06-de41-5507-a442-997148729c01', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'c2072d06-de41-5507-a442-997148729c01', 1)
on conflict do nothing;

insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 1)
on conflict do nothing;

insert into public.collections (id, handle, kind, status, position) values ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'eistee', 'manual', 'draft', 0) on conflict (handle) do nothing;

insert into public.collection_translations (collection_id, locale, title) values ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'de', 'Eistee') on conflict (collection_id, locale) do update set title = excluded.title;

insert into public.collection_products (collection_id, product_id, position) values
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 0),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 1),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 2),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'a80bbf48-a552-5164-a1df-067f05890b9e', 3)
on conflict (collection_id, product_id) do update set position = excluded.position;

insert into public.collections (id, handle, kind, status, position) values ('633547b5-44a0-5d96-a757-7f9c721440fd', 'aktion', 'manual', 'draft', 1) on conflict (handle) do nothing;

insert into public.collection_translations (collection_id, locale, title) values ('633547b5-44a0-5d96-a757-7f9c721440fd', 'de', 'Founder Bundles') on conflict (collection_id, locale) do update set title = excluded.title;

insert into public.collection_products (collection_id, product_id, position) values
  ('633547b5-44a0-5d96-a757-7f9c721440fd', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 0),
  ('633547b5-44a0-5d96-a757-7f9c721440fd', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 1),
  ('633547b5-44a0-5d96-a757-7f9c721440fd', '96b09176-62c7-5c32-a7f8-df9147b545c8', 2)
on conflict (collection_id, product_id) do update set position = excluded.position;

insert into public.collections (id, handle, kind, status, position) values ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'alle-produkte', 'manual', 'draft', 2) on conflict (handle) do nothing;

insert into public.collection_translations (collection_id, locale, title) values ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'de', 'Produkte') on conflict (collection_id, locale) do update set title = excluded.title;

insert into public.collection_products (collection_id, product_id, position) values
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 0),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 1),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'a80bbf48-a552-5164-a1df-067f05890b9e', 2),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 3),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '96b09176-62c7-5c32-a7f8-df9147b545c8', 4),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 5),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 6)
on conflict (collection_id, product_id) do update set position = excluded.position;

insert into public.collections (id, handle, kind, rules, status, position) values ('1aea467e-4320-5f94-ac6d-d726b0d9019a', 'all', 'automatic', '[{"field":"status","op":"eq","value":"active"}]', 'draft', 3) on conflict (handle) do nothing;

insert into public.collection_translations (collection_id, locale, title) values ('1aea467e-4320-5f94-ac6d-d726b0d9019a', 'de', 'Produkte') on conflict (collection_id, locale) do nothing;
