-- Abo 1070: Datenmodell für Abos (Plan docs/konto-und-abo-plan.md Teil B, Entscheidungen H23, H25).
--
-- 1. subscriptions: Abo-Nummer ABO-1001 fortlaufend (eigene Sequenz, Default über Funktion),
--    Überspringen, Preisankündigung, Wiederholungen bei Zahlungsfehlern, Kündigungszeitpunkt,
--    Erinnerung, Preisbindung bis zur Ankündigung, Sperre für den Abo-Lauf.
-- 2. subscription_events: Historie je Abo (Art, Daten, Akteur, Zeit).
-- 3. subscription_cancellation_requests: Protokoll jeder Kündigungserklärung über /abo-kuendigen
--    (§ 312k BGB), auch wenn kein Abo passt.
-- 4. subscription_orders: Art der Lieferung (erste Bestellung oder Folgelieferung) und Zeitpunkt.
-- 5. shop_settings: Standardrabatt, Rabatte je Produkt oder Variante, Intervalle, Erinnerung,
--    Wiederholungen, maximale Pause.
-- 6. Funktionen: next_subscription_number, subscription_apply (atomarer Zustandswechsel mit
--    Ereignis), subscription_claim_due (Sperre für den Abo-Lauf), subscription_release.
-- 7. RLS: Kunden lesen eigene Abos (Policy aus 0014) und eigene Ereignisse, schreiben nur über
--    Server Actions (Service Role). Staff liest, Owner/Admin schreibt.
-- 8. pg_cron (falls vorhanden): täglich Jobs subscription.run_due und subscription.reminder anlegen.
--
-- Idempotent: if not exists, create or replace, on conflict do nothing, Policies werden neu angelegt.
--
-- Rückweg (in umgekehrter Reihenfolge, nur vor dem Go-live ohne echte Abos ausführen):
--   do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then
--     perform cron.unschedule(jobname) from cron.job where jobname in ('subscription_run_due', 'subscription_reminder');
--   end if; end $$;
--   drop function if exists public.subscription_release(uuid);
--   drop function if exists public.subscription_claim_due(integer, timestamptz);
--   drop function if exists public.subscription_apply(uuid, public.subscription_status[], jsonb, text, jsonb, text, uuid);
--   delete from public.shop_settings where key in ('subscription_discount_bp', 'subscription_product_discounts',
--     'subscription_intervals', 'subscription_reminder_days', 'subscription_retry_days', 'subscription_pause_max_days');
--   alter table public.subscription_orders drop column if exists kind, drop column if exists created_at;
--   drop table if exists public.subscription_cancellation_requests;
--   drop table if exists public.subscription_events;
--   alter table public.subscriptions alter column number drop default;
--   alter table public.subscriptions
--     drop column if exists number, drop column if exists skip_next, drop column if exists price_notice_sent_at,
--     drop column if exists price_change_effective_at, drop column if exists locked_price_cents,
--     drop column if exists retry_count, drop column if exists last_payment_error,
--     drop column if exists last_payment_failed_at, drop column if exists past_due_since,
--     drop column if exists next_retry_at, drop column if exists pending_payment_intent_id,
--     drop column if exists cancel_effective_at, drop column if exists cancel_kind,
--     drop column if exists pause_reason, drop column if exists reminder_sent_for,
--     drop column if exists processing_started_at;
--   drop function if exists public.next_subscription_number();
--   drop sequence if exists public.subscription_number_seq;

-- 1. subscriptions ------------------------------------------------------------------------------

create sequence if not exists public.subscription_number_seq start with 1001 minvalue 1001;

create or replace function public.next_subscription_number()
returns text language sql volatile security definer set search_path = public, extensions as $$
  select 'ABO-' || nextval('public.subscription_number_seq')::text;
$$;

alter table public.subscriptions add column if not exists number text;
update public.subscriptions set number = public.next_subscription_number() where number is null;
alter table public.subscriptions alter column number set default public.next_subscription_number();
alter table public.subscriptions alter column number set not null;
create unique index if not exists subscriptions_number_key on public.subscriptions (number);

alter table public.subscriptions
  add column if not exists skip_next boolean not null default false,
  -- Preisankündigung (Plan B: mindestens 4 Wochen Vorlauf); bis price_change_effective_at gilt locked_price_cents
  add column if not exists price_notice_sent_at timestamptz,
  add column if not exists price_change_effective_at timestamptz,
  -- Variantenpreis inklusive Pfand (wie product_variants.price_cents), der für dieses Abo gilt
  add column if not exists locked_price_cents integer check (locked_price_cents is null or locked_price_cents >= 0),
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists last_payment_error text,
  add column if not exists last_payment_failed_at timestamptz,
  add column if not exists past_due_since timestamptz,
  add column if not exists next_retry_at timestamptz,
  -- Off-Session-Zahlung, die eine Bestätigung (3-D Secure) braucht
  add column if not exists pending_payment_intent_id text,
  add column if not exists cancel_effective_at timestamptz,
  add column if not exists cancel_kind text check (cancel_kind is null or cancel_kind in ('ordinary', 'extraordinary')),
  add column if not exists pause_reason text check (pause_reason is null or pause_reason in ('customer', 'payment_failed', 'staff')),
  -- next_order_at, für den die Erinnerung schon verschickt wurde
  add column if not exists reminder_sent_for timestamptz,
  -- Sperre des Abo-Laufs (subscription_claim_due), verhindert doppelte Lieferungen
  add column if not exists processing_started_at timestamptz;

create index if not exists subscriptions_due_idx on public.subscriptions (next_order_at)
  where status in ('active', 'paused');
create index if not exists subscriptions_status_idx on public.subscriptions (status, created_at desc);
create index if not exists subscriptions_variant_idx on public.subscriptions (variant_id);

-- 2. subscription_events -------------------------------------------------------------------------

create table if not exists public.subscription_events (
  id              bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  -- created, activated, changed, skipped, unskipped, skipped_delivery, paused, resumed, payment_failed,
  -- payment_action_required, payment_method_changed, address_changed, order_created, reminder_sent,
  -- price_notice_sent, cancelled, cancellation_scheduled, discount_changed, stock_missing
  kind            text not null check (kind ~ '^[a-z_]{3,40}$'),
  data            jsonb not null default '{}'::jsonb,
  actor_type      text not null default 'system' check (actor_type in ('customer', 'staff', 'system', 'public')),
  actor_id        uuid,
  created_at      timestamptz not null default now()
);
create index if not exists subscription_events_sub_idx on public.subscription_events (subscription_id, created_at desc);
create index if not exists subscription_events_kind_idx on public.subscription_events (kind, created_at desc);

-- 3. Kündigungserklärungen ohne Login (§ 312k BGB) ----------------------------------------------

create table if not exists public.subscription_cancellation_requests (
  id                   uuid primary key default gen_random_uuid(),
  received_at          timestamptz not null default now(),
  customer_name        text not null,
  email                citext not null,
  subscription_number  text,
  kind                 text not null check (kind in ('ordinary', 'extraordinary')),
  reason               text,
  timing               text not null check (timing in ('next_possible', 'date')),
  desired_date         date,
  -- matched: mindestens ein Abo gekündigt, unmatched: intern prüfen (Kunde erfährt nichts davon)
  status               text not null default 'received' check (status in ('received', 'matched', 'unmatched', 'resolved')),
  subscription_ids     uuid[] not null default '{}',
  confirmation_sent_at timestamptz,
  ip_hash              text,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists subscription_cancellation_requests_email_idx
  on public.subscription_cancellation_requests (email, received_at desc);
create index if not exists subscription_cancellation_requests_status_idx
  on public.subscription_cancellation_requests (status, received_at desc);

-- 4. subscription_orders ----------------------------------------------------------------------

alter table public.subscription_orders
  add column if not exists kind text not null default 'renewal' check (kind in ('initial', 'renewal')),
  add column if not exists created_at timestamptz not null default now();
create index if not exists subscription_orders_order_idx on public.subscription_orders (order_id);

-- 5. Einstellungen ------------------------------------------------------------------------------

insert into public.shop_settings (key, value, is_public) values
  ('subscription_discount_bp', '1000'::jsonb, true),
  ('subscription_product_discounts', '{"products": {}, "variants": {}}'::jsonb, true),
  ('subscription_intervals', '{"weeks": [2, 4, 6, 8], "default": 4}'::jsonb, true),
  ('subscription_reminder_days', '3'::jsonb, false),
  ('subscription_retry_days', '[3, 7]'::jsonb, false),
  ('subscription_pause_max_days', '183'::jsonb, true)
on conflict (key) do nothing;

-- 6. Funktionen ---------------------------------------------------------------------------------

-- Atomarer Zustandswechsel: sperrt das Abo, prüft den erwarteten Status, übernimmt nur erlaubte
-- Felder aus p_patch und schreibt das Ereignis in derselben Transaktion. Die fachliche
-- Zustandsmaschine liegt in src/lib/subscriptions/state.ts (getestet); hier wird nur abgesichert,
-- dass zwischen Prüfung und Schreiben niemand anderes den Status geändert hat.
-- Wirft SUBSCRIPTION_NOT_FOUND, SUBSCRIPTION_STATE_CONFLICT oder SUBSCRIPTION_FIELD_NOT_ALLOWED.
create or replace function public.subscription_apply(
  p_id uuid,
  p_expected public.subscription_status[],
  p_patch jsonb,
  p_event_kind text,
  p_event_data jsonb default '{}'::jsonb,
  p_actor_type text default 'system',
  p_actor_id uuid default null)
returns public.subscriptions language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row public.subscriptions%rowtype;
  v_new public.subscriptions%rowtype;
  v_key text;
  v_allowed constant text[] := array[
    'status', 'variant_id', 'quantity', 'interval_unit', 'interval_count', 'discount_bp',
    'payment_method_id', 'shipping_address', 'next_order_at', 'last_order_at', 'paused_until',
    'cancelled_at', 'cancel_reason', 'skip_next', 'price_notice_sent_at', 'price_change_effective_at',
    'locked_price_cents', 'retry_count', 'last_payment_error', 'last_payment_failed_at',
    'past_due_since', 'next_retry_at', 'pending_payment_intent_id', 'cancel_effective_at',
    'cancel_kind', 'pause_reason', 'reminder_sent_for', 'processing_started_at',
    'stripe_customer_id'];
begin
  select * into v_row from public.subscriptions where id = p_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using detail = p_id::text;
  end if;
  if p_expected is not null and not (v_row.status = any (p_expected)) then
    raise exception 'SUBSCRIPTION_STATE_CONFLICT'
      using detail = json_build_object('id', p_id, 'status', v_row.status, 'expected', p_expected)::text;
  end if;
  for v_key in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'SUBSCRIPTION_FIELD_NOT_ALLOWED' using detail = v_key;
    end if;
  end loop;

  v_new := jsonb_populate_record(v_row, coalesce(p_patch, '{}'::jsonb));

  update public.subscriptions set
    status = v_new.status, variant_id = v_new.variant_id, quantity = v_new.quantity,
    interval_unit = v_new.interval_unit, interval_count = v_new.interval_count,
    discount_bp = v_new.discount_bp, payment_method_id = v_new.payment_method_id,
    shipping_address = v_new.shipping_address, next_order_at = v_new.next_order_at,
    last_order_at = v_new.last_order_at, paused_until = v_new.paused_until,
    cancelled_at = v_new.cancelled_at, cancel_reason = v_new.cancel_reason,
    skip_next = v_new.skip_next, price_notice_sent_at = v_new.price_notice_sent_at,
    price_change_effective_at = v_new.price_change_effective_at,
    locked_price_cents = v_new.locked_price_cents, retry_count = v_new.retry_count,
    last_payment_error = v_new.last_payment_error, last_payment_failed_at = v_new.last_payment_failed_at,
    past_due_since = v_new.past_due_since, next_retry_at = v_new.next_retry_at,
    pending_payment_intent_id = v_new.pending_payment_intent_id,
    cancel_effective_at = v_new.cancel_effective_at, cancel_kind = v_new.cancel_kind,
    pause_reason = v_new.pause_reason, reminder_sent_for = v_new.reminder_sent_for,
    processing_started_at = v_new.processing_started_at, stripe_customer_id = v_new.stripe_customer_id,
    updated_at = now()
  where id = p_id
  returning * into v_new;

  if p_event_kind is not null then
    insert into public.subscription_events (subscription_id, kind, data, actor_type, actor_id)
    values (p_id, p_event_kind, coalesce(p_event_data, '{}'::jsonb)
              || jsonb_build_object('from_status', v_row.status, 'to_status', v_new.status),
            coalesce(p_actor_type, 'system'), p_actor_id);
  end if;
  return v_new;
end $$;

-- Fällige Abos für den Abo-Lauf sperren: aktiv und next_order_at erreicht, oder pausiert und
-- paused_until erreicht. Eine Sperre gilt 30 Minuten (abgestürzter Lauf gibt sie so wieder frei).
create or replace function public.subscription_claim_due(p_limit integer default 25, p_now timestamptz default now())
returns setof uuid language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
  with picked as materialized (
    select s.id from public.subscriptions s
     where (
             (s.status = 'active' and s.next_order_at is not null and s.next_order_at <= p_now)
          or (s.status = 'paused' and s.pause_reason is distinct from 'payment_failed'
              and s.paused_until is not null and s.paused_until <= p_now)
           )
       and (s.processing_started_at is null or s.processing_started_at < now() - interval '30 minutes')
     order by s.next_order_at nulls last
     for update skip locked
     limit greatest(coalesce(p_limit, 25), 1)
  )
  update public.subscriptions s set processing_started_at = now(), updated_at = now()
    from picked where s.id = picked.id
  returning s.id;
end $$;

-- Einzelnes Abo sperren (Wiederholung, Bestätigung, Backoffice). true, wenn die Sperre gesetzt wurde.
create or replace function public.subscription_lock(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_count integer;
begin
  update public.subscriptions set processing_started_at = now(), updated_at = now()
   where id = p_id
     and (processing_started_at is null or processing_started_at < now() - interval '30 minutes');
  get diagnostics v_count = row_count;
  return v_count = 1;
end $$;

create or replace function public.subscription_release(p_id uuid)
returns void language sql security definer set search_path = public, extensions as $$
  update public.subscriptions set processing_started_at = null, updated_at = now() where id = p_id;
$$;

revoke execute on function public.next_subscription_number() from public, anon, authenticated;
revoke execute on function public.subscription_apply(uuid, public.subscription_status[], jsonb, text, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.subscription_claim_due(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.subscription_lock(uuid) from public, anon, authenticated;
revoke execute on function public.subscription_release(uuid) from public, anon, authenticated;
grant execute on function public.next_subscription_number() to service_role;
grant execute on function public.subscription_apply(uuid, public.subscription_status[], jsonb, text, jsonb, text, uuid) to service_role;
grant execute on function public.subscription_claim_due(integer, timestamptz) to service_role;
grant execute on function public.subscription_lock(uuid) to service_role;
grant execute on function public.subscription_release(uuid) to service_role;

-- 7. RLS ----------------------------------------------------------------------------------------

alter table public.subscription_events enable row level security;
alter table public.subscription_events force row level security;
alter table public.subscription_cancellation_requests enable row level security;
alter table public.subscription_cancellation_requests force row level security;

drop policy if exists customer_subscription_events on public.subscription_events;
create policy customer_subscription_events on public.subscription_events for select to authenticated
  using (exists (select 1 from public.subscriptions s
                  where s.id = subscription_id and s.customer_id = public.current_customer_id()));
drop policy if exists staff_select on public.subscription_events;
create policy staff_select on public.subscription_events for select to authenticated using (public.is_staff());
drop policy if exists admin_write on public.subscription_events;
create policy admin_write on public.subscription_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_select on public.subscription_cancellation_requests;
create policy staff_select on public.subscription_cancellation_requests for select to authenticated using (public.is_staff());
drop policy if exists support_write on public.subscription_cancellation_requests;
create policy support_write on public.subscription_cancellation_requests for all to authenticated
  using (public.is_staff(array['support']::public.staff_role[]) or public.is_admin())
  with check (public.is_staff(array['support']::public.staff_role[]) or public.is_admin());

-- Kunden lesen die Zuordnung eigener Abos zu Bestellungen (Lieferhistorie im Portal)
drop policy if exists customer_subscription_orders on public.subscription_orders;
create policy customer_subscription_orders on public.subscription_orders for select to authenticated
  using (exists (select 1 from public.subscriptions s
                  where s.id = subscription_id and s.customer_id = public.current_customer_id()));

drop trigger if exists set_updated_at on public.subscription_cancellation_requests;
create trigger set_updated_at before update on public.subscription_cancellation_requests
  for each row execute function public.set_updated_at();

grant select on public.subscription_events to authenticated;
grant select, insert, update, delete on public.subscription_events to service_role;
grant select, insert, update, delete on public.subscription_cancellation_requests to service_role;
grant select on public.subscription_cancellation_requests to authenticated;

-- 8. Geplante Jobs (Runner /api/jobs/run führt sie aus, sobald SUBSCRIPTION_JOB_KINDS registriert sind)

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname in ('subscription_run_due', 'subscription_reminder');
    -- 05:41 UTC (vor Arbeitsbeginn): fällige Lieferungen anlegen und abbuchen
    perform cron.schedule('subscription_run_due', '41 5 * * *',
      $cron$ select public.enqueue_job('subscription.run_due', '{}'::jsonb, now(),
               'subscription.run_due:' || to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD'), 20); $cron$);
    -- 07:53 UTC: Erinnerungen "Deine nächste Lieferung" (zu einer freundlichen Uhrzeit)
    perform cron.schedule('subscription_reminder', '53 7 * * *',
      $cron$ select public.enqueue_job('subscription.reminder', '{}'::jsonb, now(),
               'subscription.reminder:' || to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD'), 60); $cron$);
  else
    raise notice 'pg_cron nicht verfügbar, Abo-Jobs übersprungen (lokale Umgebung)';
  end if;
end $$;
