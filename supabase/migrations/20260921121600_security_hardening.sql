-- 0017 Befunde der Supabase Security Advisors beheben
-- 0011 function_search_path_mutable: fester search_path für alle eigenen Funktionen ohne Angabe
-- 0028/0029: search_storefront braucht keine erhöhten Rechte, die public_read-Policies reichen (SECURITY INVOKER).
--            available_quantity bleibt SECURITY DEFINER (liest inventory_levels, gibt nur eine Zahl zurück), das ist beabsichtigt.
--            is_staff/is_admin/current_customer_id/current_staff_role sind für authenticated bewusst aufrufbar, RLS-Policies brauchen sie.

alter function public.set_updated_at() set search_path = public, extensions;
alter function public.random_token(int) set search_path = public, extensions;
alter function public.sha256_hex(text) set search_path = public, extensions;
alter function public.slugify(text) set search_path = public, extensions;
alter function public.lowest_price_last_30_days(uuid) set search_path = public, extensions;
alter function public.variant_deposit_cents(uuid) set search_path = public, extensions;
alter function public.variant_base_price_cents(uuid) set search_path = public, extensions;
alter function public.bundle_components_sum_cents(uuid) set search_path = public, extensions;
alter function public.current_legal_version(public.legal_document_kind, text) set search_path = public, extensions;
alter function public.search_storefront(text, text, integer) security invoker;
