-- Checkout 1040: Nummernkreis der Bestellungen PV-10001, PV-10002, ...
--
-- Bisher erzeugte der Default ('PV-' || lpad(nextval, 6, '0')) sechsstellige Nummern mit führender
-- Null (PV-010001). Vorgabe ist PV-10001 aufwärts, deshalb eine eigene Funktion mit fünf Stellen
-- Mindestbreite (ab PV-100000 wächst die Nummer einfach weiter, ohne Überlauf).
-- Die TypeScript-Spiegelung steht in src/lib/checkout/order-number.ts (getestet).
--
-- Idempotent: create or replace, alter default, setval nur nach oben.
--
-- Rückweg:
--   alter table public.orders alter column order_number
--     set default ('PV-' || lpad(nextval('public.order_number_seq')::text, 6, '0'));
--   drop function if exists public.next_order_number();

create or replace function public.next_order_number()
returns text language sql volatile security definer set search_path = public, extensions as $$
  select 'PV-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

alter table public.orders alter column order_number set default public.next_order_number();

-- Sequenz auf die nächste freie Nummer setzen: höchste vergebene Nummer plus 1, mindestens 10001.
-- Testbestellungen, die vor dem Go-live wieder gelöscht wurden, hinterlassen so keine Lücke am Anfang.
-- Liegen schon echte Bestellungen vor, bleibt die Sequenz mindestens auf ihrem aktuellen Stand.
do $$
declare
  v_max  bigint;
  v_next bigint;
  v_seq  record;
begin
  select coalesce(max(substring(order_number from '^PV-0*([0-9]+)$')::bigint), 10000)
    into v_max from public.orders where order_number ~ '^PV-[0-9]+$';
  select last_value, is_called into v_seq from public.order_number_seq;
  v_next := greatest(v_max + 1, 10001);
  -- nie zurückdrehen, wenn die Sequenz schon weiter ist und Bestellungen existieren
  if exists (select 1 from public.orders) and v_seq.is_called and v_seq.last_value >= v_next then
    return;
  end if;
  perform setval('public.order_number_seq', v_next, false);
end $$;

revoke execute on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;
