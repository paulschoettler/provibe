-- Backoffice Bestellungen 2020: Job-Runner (Sperre mit SKIP LOCKED, Backoff 2^attempts Minuten)
-- und Vorlagen-Übersicht für Versandbestätigung und Erstattung.
--
-- Der Runner (src/lib/admin/jobs/runner.ts, Route /api/jobs/run, Netlify Scheduled Function
-- jobs-run alle 5 Minuten) holt fällige Jobs einzeln über claim_due_jobs und meldet das Ergebnis
-- über complete_job (0010) beziehungsweise fail_job_with_backoff zurück. claim_jobs und fail_job
-- aus 0010 bleiben unverändert (Checkout nutzt complete_job/fail_job für den Inline-Versuch).
--
-- Idempotent: create or replace, on conflict do nothing.
--
-- Rückweg:
--   drop function if exists public.claim_due_jobs(text, integer, text[]);
--   drop function if exists public.fail_job_with_backoff(uuid, text);
--   delete from public.email_templates where key in ('shipping_confirmation', 'refund_confirmation');

-- Fällige Jobs sperren. Gibt höchstens p_limit Jobs zurück (status running, attempts + 1).
-- Vorher werden hängende Jobs (Worker seit 15 Minuten ohne Rückmeldung) wieder eingereiht,
-- damit der Runner auch ohne pg_cron (lokal, oder wenn der Cron-Job fehlt) nichts verliert.
create or replace function public.claim_due_jobs(
  p_worker text, p_limit integer default 1, p_kinds text[] default null)
returns setof public.jobs language plpgsql security definer set search_path = public as $$
begin
  update public.jobs
     set status = 'queued', locked_at = null, locked_by = null, updated_at = now(),
         last_error = coalesce(last_error, '') || ' [requeued: worker timeout]'
   where status = 'running' and locked_at < now() - interval '15 minutes';

  -- Auswahl als MATERIALIZED CTE: Bei "where id in (select ... limit n for update skip locked)"
  -- darf der Planer die Unterabfrage mehrfach ausführen und dann mehr als n Zeilen sperren
  -- (remote mit claim_jobs aus 0010 beobachtet: limit 1 sperrte zwei Jobs).
  return query
  with picked as materialized (
    select q.id from public.jobs q
     where q.status = 'queued' and q.run_at <= now()
       and (p_kinds is null or q.kind = any (p_kinds))
     order by q.priority, q.run_at
     for update skip locked
     limit greatest(coalesce(p_limit, 1), 1)
  )
  update public.jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, updated_at = now()
    from picked
   where j.id = picked.id
  returning j.*;
end $$;

-- Fehlschlag mit Backoff: run_at = now() + 2^attempts Minuten (2, 4, 8, ... höchstens 24 Stunden).
-- attempts ist beim Aufruf schon durch claim_due_jobs erhöht. Ab max_attempts: status dead.
create or replace function public.fail_job_with_backoff(p_id uuid, p_error text)
returns public.job_status language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = p_id for update;
  if not found then return null; end if;
  if v_job.attempts >= v_job.max_attempts then
    update public.jobs
       set status = 'dead', last_error = left(p_error, 2000), finished_at = now(),
           locked_at = null, locked_by = null, updated_at = now()
     where id = p_id;
    return 'dead';
  end if;
  update public.jobs
     set status = 'queued', last_error = left(p_error, 2000), locked_at = null, locked_by = null,
         updated_at = now(),
         run_at = now() + least(interval '24 hours', interval '1 minute' * power(2, greatest(v_job.attempts, 0)))
   where id = p_id;
  return 'queued';
end $$;

revoke execute on function public.claim_due_jobs(text, integer, text[]) from public, anon, authenticated;
revoke execute on function public.fail_job_with_backoff(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_due_jobs(text, integer, text[]) to service_role;
grant execute on function public.fail_job_with_backoff(uuid, text) to service_role;

-- Vorlagen-Übersicht (Inhalt im Code: src/lib/admin/orders/emails.ts)
insert into public.email_templates (key, name, description, category, subject_template, preview_props, is_enabled)
values
  ('shipping_confirmation', 'Versandbestätigung',
   'Geht raus, sobald im Backoffice eine Trackingnummer gespeichert wird. Enthält Versanddienst, Sendungsnummer und Link zur Sendungsverfolgung.',
   'transactional', 'Deine Bestellung {{order_number}} ist unterwegs',
   '{"order_number":"PV-10001","tracking_number":"00340434161094000000"}'::jsonb, true),
  ('refund_confirmation', 'Erstattung',
   'Bestätigt eine Teil- oder Vollerstattung mit Betrag und erstatteten Positionen. Der interne Grund wird nicht mitgeschickt.',
   'transactional', 'Erstattung zu deiner Bestellung {{order_number}}',
   '{"order_number":"PV-10001","amount":"26,10 €"}'::jsonb, true)
on conflict (key) do nothing;
