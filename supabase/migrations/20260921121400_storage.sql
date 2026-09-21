-- 0015 Storage-Buckets und Policies
-- product-media, media: öffentlich lesbar (Bilder). invoices, shipping-labels, source-assets: privat, Zugriff nur
-- über signierte URLs aus Server-Code (Service Role) oder Staff.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-media',   'product-media',   true,  26214400, array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm']),
  ('media',           'media',           true,  26214400, array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml','video/mp4','video/webm','application/pdf']),
  ('invoices',        'invoices',        false, 10485760, array['application/pdf']),
  ('shipping-labels', 'shipping-labels', false, 10485760, array['application/pdf']),
  ('source-assets',   'source-assets',   false, 104857600, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  execute 'create policy "public read media" on storage.objects for select to anon, authenticated using (bucket_id in (''product-media'', ''media''))';
  execute 'create policy "staff manage media" on storage.objects for all to authenticated using (bucket_id in (''product-media'', ''media'', ''source-assets'') and public.is_staff()) with check (bucket_id in (''product-media'', ''media'', ''source-assets'') and public.is_staff())';
  execute 'create policy "staff read private" on storage.objects for select to authenticated using (bucket_id in (''invoices'', ''shipping-labels'') and public.is_staff())';
exception when duplicate_object then null;
end $$;
