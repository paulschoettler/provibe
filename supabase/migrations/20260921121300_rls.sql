-- 0014 Row Level Security auf jeder Tabelle, updated_at-Trigger, Grants
-- Prinzip: Service Role (nur in Netlify Functions / Server) umgeht RLS. Für anon/authenticated gilt:
--   * öffentliche Lesezugriffe nur auf veröffentlichte Katalog- und Inhaltsdaten
--   * Kunden sehen ausschließlich eigene Daten
--   * Staff über is_staff() / is_admin()

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
  for t in select c.table_name from information_schema.columns c
           join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public'
           where c.table_schema = 'public' and c.column_name = 'updated_at' loop
    execute format('drop trigger if exists set_updated_at on public.%I', t.table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t.table_name);
  end loop;
end $$;

-- Staff: Lesen überall, Schreiben je nach Rolle -------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create policy staff_select on public.%I for select to authenticated using (public.is_staff())', t.tablename);
  end loop;
end $$;

-- Owner/Admin: alles schreiben
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
           and tablename not in ('audit_log', 'price_history', 'webhook_events', 'consent_logs') loop
    execute format('create policy admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t.tablename);
  end loop;
end $$;

-- Support: Kunden, Bestellungen, Notizen, Leads, Kontakt, Widerruf, Bewertungen, Newsletter-Kontakte
do $$
declare t text;
begin
  foreach t in array array['customers','customer_addresses','customer_notes','customer_events','orders','order_events','order_notes',
                           'refunds','leads','lead_notes','contact_messages','withdrawal_requests','reviews','newsletter_contacts','jobs'] loop
    execute format('create policy support_write on public.%I for all to authenticated using (public.is_staff(array[''support'',''fulfillment'']::public.staff_role[])) with check (public.is_staff(array[''support'',''fulfillment'']::public.staff_role[]))', t);
  end loop;
  -- Fulfillment zusätzlich: Sendungen, Bestand
  foreach t in array array['shipments','inventory_levels','inventory_movements','order_items'] loop
    execute format('create policy fulfillment_write on public.%I for all to authenticated using (public.is_staff(array[''fulfillment'']::public.staff_role[])) with check (public.is_staff(array[''fulfillment'']::public.staff_role[]))', t);
  end loop;
end $$;

-- Öffentlich lesbar (anon + authenticated) ------------------------------------
create policy public_read on public.products for select to anon, authenticated using (status = 'active');
create policy public_read on public.product_translations for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.product_options for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy public_read on public.bundle_components for select to anon, authenticated
  using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                 where v.id = bundle_variant_id and p.status = 'active'));
create policy public_read on public.collections for select to anon, authenticated using (status = 'published');
create policy public_read on public.collection_translations for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.status = 'published'));
create policy public_read on public.collection_products for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.status = 'published'));
create policy public_read on public.pages for select to anon, authenticated using (status = 'published');
create policy public_read on public.page_translations for select to anon, authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.status = 'published'));
create policy public_read on public.legal_documents for select to anon, authenticated using (true);
create policy public_read on public.legal_document_versions for select to anon, authenticated using (status = 'published');
create policy public_read on public.homepage_modules for select to anon, authenticated using (is_enabled);
create policy public_read on public.blog_posts for select to anon, authenticated using (status = 'published');
create policy public_read on public.blog_post_translations for select to anon, authenticated
  using (exists (select 1 from public.blog_posts b where b.id = post_id and b.status = 'published'));
create policy public_read on public.redirects for select to anon, authenticated using (is_enabled);
create policy public_read on public.shop_settings for select to anon, authenticated using (is_public);
create policy public_read on public.tax_rates for select to anon, authenticated using (true);
create policy public_read on public.shipping_zones for select to anon, authenticated using (is_enabled);
create policy public_read on public.shipping_rates for select to anon, authenticated
  using (is_enabled and exists (select 1 from public.shipping_zones z where z.id = zone_id and z.is_enabled));
create policy public_read on public.announcement_messages for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy public_read on public.menus for select to anon, authenticated using (true);
create policy public_read on public.menu_items for select to anon, authenticated using (true);
create policy public_read on public.reviews for select to anon, authenticated using (status = 'approved');
create policy public_read on public.media_assets for select to anon, authenticated using (bucket in ('media', 'product-media'));

-- Kunden: eigene Daten --------------------------------------------------------
create policy customer_self on public.customers for select to authenticated using (auth_user_id = auth.uid());
create policy customer_self_update on public.customers for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy customer_addresses_self on public.customer_addresses for all to authenticated
  using (customer_id = public.current_customer_id()) with check (customer_id = public.current_customer_id());
create policy customer_orders on public.orders for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_order_items on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy customer_order_events on public.order_events for select to authenticated
  using (visible_to_customer and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy customer_shipments on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy customer_refunds on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy customer_reviews on public.reviews for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_newsletter on public.newsletter_contacts for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_subscriptions on public.subscriptions for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_payment_methods on public.customer_payment_methods for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_consent on public.consent_logs for select to authenticated using (customer_id = public.current_customer_id());

-- Grants: anon/authenticated dürfen die API nutzen, RLS begrenzt die Sicht. Schreibzugriffe auf
-- Warenkorb, Checkout, Bestellungen, Formulare laufen ausschließlich serverseitig (Service Role).
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- Interne Funktionen nicht über die API für anon freigeben
revoke execute on function public.reserve_stock(uuid, jsonb, interval) from public, anon, authenticated;
revoke execute on function public.release_reservations(uuid) from public, anon, authenticated;
revoke execute on function public.commit_reservations(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.expire_reservations() from public, anon, authenticated;
revoke execute on function public.apply_inventory_movement(uuid, integer, public.inventory_reason, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.enqueue_job(text, jsonb, timestamptz, text, integer, uuid, integer) from public, anon, authenticated;
revoke execute on function public.claim_jobs(text, text[], integer) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.retry_job(uuid) from public, anon, authenticated;
revoke execute on function public.requeue_stuck_jobs() from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.record_price_history() from public, anon, authenticated;
revoke execute on function public.refresh_customer_stats() from public, anon, authenticated;
revoke execute on function public.bump_discount_usage() from public, anon, authenticated;
-- Öffentlich nutzbar (nur lesend, keine sensiblen Daten)
grant execute on function public.available_quantity(uuid) to anon, authenticated;
grant execute on function public.variant_deposit_cents(uuid) to anon, authenticated;
grant execute on function public.variant_base_price_cents(uuid) to anon, authenticated;
grant execute on function public.bundle_components_sum_cents(uuid) to anon, authenticated;
grant execute on function public.lowest_price_last_30_days(uuid) to anon, authenticated;
grant execute on function public.search_storefront(text, text, integer) to anon, authenticated;
grant execute on function public.current_legal_version(public.legal_document_kind, text) to anon, authenticated;
