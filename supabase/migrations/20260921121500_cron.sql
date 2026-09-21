-- 0016 Geplante Datenbank-Jobs (pg_cron, nur wenn verfügbar; lokal ohne pg_cron ein No-op)

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobname) from cron.job where jobname in ('expire_reservations', 'requeue_stuck_jobs', 'mark_abandoned_carts', 'purge_rate_limits');
    perform cron.schedule('expire_reservations', '*/2 * * * *', $cron$ select public.expire_reservations(); $cron$);
    perform cron.schedule('requeue_stuck_jobs', '*/10 * * * *', $cron$ select public.requeue_stuck_jobs(); $cron$);
    perform cron.schedule('mark_abandoned_carts', '17 * * * *',
      $cron$ update public.carts set status = 'abandoned', updated_at = now()
             where status = 'active' and last_activity_at < now() - interval '30 days'; $cron$);
    perform cron.schedule('purge_rate_limits', '33 3 * * *',
      $cron$ delete from public.rate_limits where window_start < now() - interval '2 days'; $cron$);
  else
    raise notice 'pg_cron nicht verfügbar, geplante Jobs übersprungen (lokale Umgebung)';
  end if;
end $$;
