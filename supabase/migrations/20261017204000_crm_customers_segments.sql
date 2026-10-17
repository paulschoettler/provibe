-- 2040 Backoffice CRM: Kunden sperren, gespeicherte Segmente, sichere Segment-Auswertung
--
-- Inhalt:
--   1. customers: blocked_at, blocked_reason, blocked_by (Sperre aus dem Backoffice, blockCustomer)
--   2. saved_segments: description, last_count, last_counted_at, updated_by
--   3. crm_segment_count / crm_segment_members / crm_segment_contact_ids
--      Werten eine WHERE-Bedingung aus, die ausschließlich der Übersetzer in
--      src/lib/admin/segments/rules.ts erzeugt (Whitelist der Felder und Operatoren). Alle Werte
--      kommen als jsonb-Array $1 und werden per EXECUTE ... USING gebunden, nie in den SQL-Text
--      eingesetzt. Zusätzliche Schutzschicht hier: Länge begrenzt, Kommentare, Semikolons und
--      schreibende Schlüsselwörter werden abgewiesen, die Funktionen sind STABLE (Postgres lehnt
--      schreibende Befehle in nicht volatilen Funktionen ab) und nur für service_role ausführbar.
--
-- Idempotent: add column if not exists, create or replace.
--
-- Rückweg (manuell):
--   drop function if exists public.crm_segment_contact_ids(text, jsonb);
--   drop function if exists public.crm_segment_members(text, jsonb, integer, integer, text);
--   drop function if exists public.crm_segment_count(text, jsonb);
--   drop function if exists public.crm_assert_segment_sql(text);
--   alter table public.saved_segments drop column if exists description, drop column if exists last_count,
--     drop column if exists last_counted_at, drop column if exists updated_by;
--   alter table public.customers drop column if exists blocked_at, drop column if exists blocked_reason,
--     drop column if exists blocked_by;

-- 1. Kunden sperren --------------------------------------------------------------
alter table public.customers add column if not exists blocked_at timestamptz;
alter table public.customers add column if not exists blocked_reason text;
alter table public.customers add column if not exists blocked_by uuid;
create index if not exists customers_last_order_idx on public.customers (last_order_at desc nulls last);
create index if not exists customers_created_idx on public.customers (created_at desc);

-- 2. Gespeicherte Segmente --------------------------------------------------------
alter table public.saved_segments add column if not exists description text;
alter table public.saved_segments add column if not exists last_count integer;
alter table public.saved_segments add column if not exists last_counted_at timestamptz;
alter table public.saved_segments add column if not exists updated_by uuid;

-- 3. Segment-Auswertung -----------------------------------------------------------
create or replace function public.crm_assert_segment_sql(p_where text)
returns void language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_where is null or length(p_where) = 0 then
    raise exception 'Segment: leere Bedingung' using errcode = '22023';
  end if;
  if length(p_where) > 12000 then
    raise exception 'Segment: Bedingung zu lang' using errcode = '22023';
  end if;
  if p_where ~ '(;|--|/\*|\*/)' then
    raise exception 'Segment: unzulässige Zeichen' using errcode = '22023';
  end if;
  if p_where ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set_config|dblink|lo_import|pg_read_file|pg_sleep)\M' then
    raise exception 'Segment: unzulässiges Schlüsselwort' using errcode = '22023';
  end if;
  if p_where ~* '\m(auth|storage|vault|pg_catalog|information_schema)\s*\.' then
    raise exception 'Segment: unzulässiges Schema' using errcode = '22023';
  end if;
end $$;

create or replace function public.crm_segment_count(p_where text, p_params jsonb default '[]'::jsonb)
returns bigint language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_count bigint;
begin
  perform public.crm_assert_segment_sql(p_where);
  execute format(
    'select count(*) from public.customers c where c.anonymized_at is null and (%s)', p_where)
    into v_count using coalesce(p_params, '[]'::jsonb);
  return v_count;
end $$;

create or replace function public.crm_segment_members(
  p_where text, p_params jsonb default '[]'::jsonb, p_limit integer default 50, p_offset integer default 0,
  p_order text default 'last_order_desc')
returns setof uuid language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_order text;
begin
  perform public.crm_assert_segment_sql(p_where);
  v_order := case p_order
    when 'created_desc' then 'c.created_at desc, c.id'
    when 'total_spent_desc' then 'c.total_spent_cents desc, c.id'
    when 'orders_desc' then 'c.orders_count desc, c.id'
    when 'name_asc' then 'lower(coalesce(c.last_name, '''')), lower(coalesce(c.first_name, '''')), c.email, c.id'
    else 'c.last_order_at desc nulls last, c.created_at desc, c.id'
  end;
  return query execute format(
    'select c.id from public.customers c where c.anonymized_at is null and (%s) order by %s limit %s offset %s',
    p_where, v_order, least(greatest(coalesce(p_limit, 50), 0), 5000), greatest(coalesce(p_offset, 0), 0))
    using coalesce(p_params, '[]'::jsonb);
end $$;

-- Versandfähige Newsletter-Kontakte eines Segments: subscribed, bestätigt, nicht gesperrt
create or replace function public.crm_segment_contact_ids(p_where text, p_params jsonb default '[]'::jsonb)
returns setof uuid language plpgsql stable security invoker set search_path = public, extensions as $$
begin
  perform public.crm_assert_segment_sql(p_where);
  return query execute format(
    'select distinct n.id from public.newsletter_contacts n
       join public.customers c on (n.customer_id = c.id or n.email = c.email)
      where c.anonymized_at is null and (%s)
        and n.status = ''subscribed'' and n.confirmed_at is not null
        and not exists (select 1 from public.email_suppressions s where s.email = n.email)
      order by n.id',
    p_where)
    using coalesce(p_params, '[]'::jsonb);
end $$;

revoke execute on function public.crm_assert_segment_sql(text) from public, anon, authenticated;
revoke execute on function public.crm_segment_count(text, jsonb) from public, anon, authenticated;
revoke execute on function public.crm_segment_members(text, jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.crm_segment_contact_ids(text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_assert_segment_sql(text) to service_role;
grant execute on function public.crm_segment_count(text, jsonb) to service_role;
grant execute on function public.crm_segment_members(text, jsonb, integer, integer, text) to service_role;
grant execute on function public.crm_segment_contact_ids(text, jsonb) to service_role;
