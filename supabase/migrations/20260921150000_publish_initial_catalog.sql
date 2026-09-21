-- 0018 Katalog für die Storefront freischalten (Vor-Go-live, Site liegt hinter Basic Auth).
-- Die Storefront liest ausschließlich über RLS (anon), deshalb müssen Inhalte "active"/"published" sein.
update public.products set status = 'active', published_at = coalesce(published_at, now())
where handle in ('wildberry','peach','raspberry-lime','provibe-eistee-mixed','founder-bundle-i','founder-bundle-ii','founder-bundle-iii-1','provibe-shirt','provibe-clear-cup');
update public.collections set status = 'published';
update public.pages set status = 'published';
update public.legal_document_versions set status = 'published', effective_from = coalesce(effective_from, now()) where version = 1;
-- Farbwelt je Sorte für Hero und Sequenz (Antwort G1), pflegbar im Backoffice
update public.products set attributes = attributes || '{"palette":{"from":"#F7DCEB","via":"#E98AB0","to":"#B5578C","accent":"#702249"},"notes":"Brombeere · Heidelbeere · Erdbeere"}'::jsonb where handle = 'wildberry';
update public.products set attributes = attributes || '{"palette":{"from":"#FBF8EE","via":"#F7DCEB","to":"#D9306E","accent":"#D9306E"},"notes":"Himbeere · spritzige Limette"}'::jsonb where handle = 'raspberry-lime';
update public.products set attributes = attributes || '{"palette":{"from":"#FBF8EE","via":"#F7CA99","to":"#F3EDA4","accent":"#D97A3A"},"notes":"Saftiger Pfirsich"}'::jsonb where handle = 'peach';
