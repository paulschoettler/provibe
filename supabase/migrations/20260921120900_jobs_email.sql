-- 0010 Job-Queue (Retries, Idempotenz), E-Mail-Protokoll, Sperrliste

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled');

create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,                 -- z.B. lexware.create_invoice, email.send, dhl.create_label, tracking.purchase
  payload         jsonb not null default '{}'::jsonb,
  status          public.job_status not null default 'queued',
  priority        integer not null default 100,  -- kleiner = früher
  run_at          timestamptz not null default now(),
  attempts        integer not null default 0,
  max_attempts    integer not null default 8,
  last_error      text,
  locked_at       timestamptz,
  locked_by       text,
  idempotency_key text unique,
  order_id        uuid references public.orders (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index jobs_queue_idx on public.jobs (priority, run_at) where status = 'queued';
create index jobs_order_idx on public.jobs (order_id);
create index jobs_kind_status_idx on public.jobs (kind, status);

create or replace function public.enqueue_job(
  p_kind text, p_payload jsonb default '{}'::jsonb, p_run_at timestamptz default now(),
  p_idempotency_key text default null, p_priority integer default 100, p_order_id uuid default null,
  p_max_attempts integer default 8)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.jobs (kind, payload, run_at, idempotency_key, priority, order_id, max_attempts)
  values (p_kind, p_payload, p_run_at, p_idempotency_key, p_priority, p_order_id, p_max_attempts)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Jobs für einen Worker sperren (SKIP LOCKED, mehrere Worker parallel möglich)
create or replace function public.claim_jobs(p_worker text, p_kinds text[] default null, p_limit integer default 10)
returns setof public.jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1, updated_at = now()
   where j.id in (
     select id from public.jobs
      where status = 'queued' and run_at <= now() and (p_kinds is null or kind = any (p_kinds))
      order by priority, run_at
      for update skip locked
      limit p_limit)
  returning j.*;
end $$;

create or replace function public.complete_job(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.jobs set status = 'succeeded', finished_at = now(), locked_at = null, locked_by = null, updated_at = now()
  where id = p_id;
$$;

-- Fehlschlag: exponentielles Backoff (30s, 1m, 2m, 4m, ... max 6h), nach max_attempts -> dead
create or replace function public.fail_job(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = p_id for update;
  if not found then return; end if;
  if v_job.attempts >= v_job.max_attempts then
    update public.jobs set status = 'dead', last_error = p_error, finished_at = now(), locked_at = null, locked_by = null, updated_at = now()
    where id = p_id;
  else
    update public.jobs set status = 'queued', last_error = p_error, locked_at = null, locked_by = null, updated_at = now(),
      run_at = now() + least(interval '6 hours', interval '30 seconds' * power(2, v_job.attempts - 1))
    where id = p_id;
  end if;
end $$;

-- Manuell "erneut versuchen" aus dem Backoffice
create or replace function public.retry_job(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.jobs set status = 'queued', run_at = now(), attempts = 0, last_error = null, finished_at = null, updated_at = now()
  where id = p_id and status in ('failed', 'dead');
$$;

-- Hängende Jobs (Worker abgestürzt) nach 15 Minuten wieder freigeben
create or replace function public.requeue_stuck_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.jobs set status = 'queued', locked_at = null, locked_by = null, updated_at = now(),
    last_error = coalesce(last_error, '') || ' [requeued: worker timeout]'
  where status = 'running' and locked_at < now() - interval '15 minutes';
  get diagnostics n = row_count;
  return n;
end $$;

create type public.email_category as enum ('transactional', 'marketing', 'auth', 'internal');
create type public.email_status   as enum ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed', 'blocked_allowlist');

create table public.email_messages (
  id                  uuid primary key default gen_random_uuid(),
  to_email            citext not null,
  from_email          text not null,
  reply_to            text,
  subject             text not null,
  template            text not null,
  category            public.email_category not null default 'transactional',
  provider            text not null default 'resend',
  provider_message_id text unique,
  status              public.email_status not null default 'queued',
  error               text,
  order_id            uuid references public.orders (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  campaign_id         uuid,
  metadata            jsonb not null default '{}'::jsonb,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index email_messages_to_idx on public.email_messages (to_email, created_at desc);
create index email_messages_order_idx on public.email_messages (order_id);

create table public.email_suppressions (
  email      citext primary key,
  reason     text not null check (reason in ('bounce', 'complaint', 'manual', 'unsubscribe')),
  source     text,
  created_at timestamptz not null default now()
);

-- Übersicht der Vorlagen fürs Backoffice (Inhalt liegt als React Email im Code)
create table public.email_templates (
  key              text primary key,
  name             text not null,
  description      text,
  category         public.email_category not null default 'transactional',
  subject_template text not null,
  preview_props    jsonb not null default '{}'::jsonb,
  is_enabled       boolean not null default true,
  updated_at       timestamptz not null default now()
);
