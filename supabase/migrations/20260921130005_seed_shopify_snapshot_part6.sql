-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...
-- Teil 6 von 6

insert into public.homepage_modules (id, kind, position, is_enabled, config) values
  ('71d79f3e-04a2-5ceb-a45c-a523e0abdce3', 'hero', 0, true, '{"eyebrow":"Eistee mit Protein","headline":"Protein, das in jede Tasche passt.","text":"Schluss mit Shakern und Pulver. provibe ist erfrischender Eistee mit 15 g Protein – einfach kalt genießen, überall.","badges":["15 g Protein","Ohne Zucker","Eiskalt & erfrischend"],"cta":{"label":"Jetzt entdecken","url":"/collections/all"},"image":"seed/images/Element_9_10x_7c776464-d280-4ff9-9b5c-f78aebf50ba7.png"}'::jsonb),
  ('f3fa5d09-fcc9-51b6-ac59-378dba8b6951', 'bestseller', 1, true, '{"eyebrow":"Unser Bestseller","product_handle":"provibe-eistee-mixed","details_label":"Alle Details ansehen"}'::jsonb),
  ('55beadf3-84de-57de-ad04-06e6177a784c', 'flavors', 2, true, '{"eyebrow":"Unsere Sorten","headline":"Such dir deinen Vibe.","cta":{"label":"Alle ansehen","url":"/collections/all"},"items":[{"product_handle":"peach","notes":"Saftiger Pfirsich","image":"seed/images/provibe-peach.png"},{"product_handle":"wildberry","notes":"Brombeere · Heidelbeere · Erdbeere","image":"seed/images/provibe-wildberry.png"},{"product_handle":"raspberry-lime","notes":"Himbeere · spritzige Limette","image":"seed/images/provibe-raspberry.png"}]}'::jsonb),
  ('8d058ccf-19ba-56d6-af81-5b358fe566f9', 'story', 3, true, '{"eyebrow":"Protein for your purse","headline":"Schluss mit dem pelzigen Proteingefühl.","text":"Keine Lust mehr auf eine 30-€-Riesendose Pulver, die nach Sport schmeckt und null erfrischt? provibe ist der erfrischendste Eistee mit 15 g Protein – ready to drink, klein genug für jede Tasche.","cta":{"label":"Jetzt entdecken","url":"/collections/all"}}'::jsonb),
  ('fca9b973-c067-5200-a07a-035c975f26bb', 'bundles', 4, true, '{"eyebrow":"Founder Bundles","headline":"Alles in einem Set.","collection_handle":"aktion","badge":"Limitiertes Set","cta":{"label":"Alle ansehen","url":"/collections/aktion"}}'::jsonb)
on conflict (id) do update set config = excluded.config, position = excluded.position;

insert into public.staff_invites (email, role) values ('hello@provibe-drinks.de', 'owner'), ('mail@paulschoettler.de', 'owner') on conflict (email) do nothing;
