-- 0001 Extensions, Basisfunktionen
-- Geldbeträge: integer in Cent. Zeitstempel: timestamptz (UTC). Locale: text ('de'), mehrsprachig vorbereitet.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Supabase legt in neuen Projekten public.rls_auto_enable() als SECURITY DEFINER an.
-- Die Funktion muss nicht über die API aufrufbar sein (Security Advisor 0028/0029).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Zufälliges, URL-sicheres Token (für Bestätigungslinks, Warenkorb-Tokens)
create or replace function public.random_token(p_bytes int default 24)
returns text language sql volatile as $$
  select translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/=', '-_');
$$;

create or replace function public.sha256_hex(p_input text)
returns text language sql immutable as $$
  select encode(extensions.digest(p_input, 'sha256'), 'hex');
$$;

-- Slug-Hilfe für Handles (deutsch: ä→ae usw.)
create or replace function public.slugify(p_input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(replace(replace(replace(replace(p_input,'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'))),
    '[^a-z0-9]+', '-', 'g'));
$$;
