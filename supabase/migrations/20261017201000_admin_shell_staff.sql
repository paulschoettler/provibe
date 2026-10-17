-- 2010 Admin-Shell: Zwei-Faktor-Wiederherstellung, Staff-Einladung, Rollenrechte (H15, H19)
--
-- Inhalt:
--   1. staff_recovery_codes: Wiederherstellungscodes als Hash (scrypt, im Server erzeugt), einmalig
--      verwendbar. Nur Service Role, keine Policies für anon/authenticated (Entscheidung H15).
--   2. invite_staff(email, role, actor): nur Owner. Schreibt staff_invites. Gibt es zur Adresse schon
--      einen Auth-Benutzer (zum Beispiel ein Kundenkonto), entsteht der staff_users-Eintrag sofort,
--      weil der Trigger handle_new_auth_user nur beim Anlegen eines Auth-Benutzers greift.
--   3. Policies nach H19: staff_users und staff_invites schreibt nur ein Owner (vorher Owner und Admin
--      über admin_write). Lesen bleibt für alle aktiven Staff-Benutzer (staff_select).
--   4. Zugänge laut Antwort vom 17.10.2026: hello@provibe-drinks.de Owner, mail@paulschoettler.de
--      Admin. Idempotent als staff_invites; bestehende staff_users-Einträge dieser zwei Adressen
--      bekommen die entschiedene Rolle, fehlende werden aus auth.users angelegt.
--
-- Rückweg (manuell, in dieser Reihenfolge):
--   drop policy if exists owner_write on public.staff_users;
--   drop policy if exists owner_write on public.staff_invites;
--   create policy admin_write on public.staff_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
--   create policy admin_write on public.staff_invites for all to authenticated using (public.is_admin()) with check (public.is_admin());
--   drop function if exists public.invite_staff(text, public.staff_role, uuid);
--   drop table if exists public.staff_recovery_codes;
--   update public.staff_users set role = 'owner' where email = 'mail@paulschoettler.de';   -- nur falls gewünscht
--   update public.staff_invites set role = 'owner' where email = 'mail@paulschoettler.de';

-- 1. Wiederherstellungscodes ---------------------------------------------------------------
create table if not exists public.staff_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.staff_users (user_id) on delete cascade,
  code_hash  text not null,              -- scrypt$<salt>$<hash>, nie der Klartext
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists staff_recovery_codes_open_idx
  on public.staff_recovery_codes (user_id) where used_at is null;

alter table public.staff_recovery_codes enable row level security;
alter table public.staff_recovery_codes force row level security;
revoke all on public.staff_recovery_codes from anon, authenticated;
grant all on public.staff_recovery_codes to service_role;

-- 2. Einladung -----------------------------------------------------------------------------
-- Aufruf aus Server Actions mit dem Service-Role-Client: auth.uid() ist dort leer, deshalb wird der
-- handelnde Benutzer als p_actor übergeben und nur bei Rolle service_role akzeptiert. Mit einer
-- Benutzer-Sitzung (authenticated) zählt ausschließlich auth.uid().
-- Ergebnis: 'invited' (Einladung offen), 'linked' (bestehender Auth-Benutzer ist jetzt Staff),
--           'already_staff' (aktiver Staff-Benutzer, nichts geändert), 'reactivated'.
create or replace function public.invite_staff(
  p_email text, p_role public.staff_role, p_actor uuid default null
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_actor uuid;
  v_email citext := lower(trim(p_email))::citext;
  v_user  auth.users%rowtype;
  v_staff public.staff_users%rowtype;
begin
  if auth.role() = 'service_role' then
    v_actor := coalesce(p_actor, auth.uid());
  else
    v_actor := auth.uid();
  end if;
  if v_actor is null or not exists (
    select 1 from public.staff_users s where s.user_id = v_actor and s.is_active and s.role = 'owner'
  ) then
    raise exception 'Nur Owner dürfen Benutzer einladen' using errcode = '42501';
  end if;
  if v_email is null or v_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ungültige E-Mail-Adresse' using errcode = '22023';
  end if;

  select * into v_staff from public.staff_users where email = v_email;
  if found then
    if v_staff.is_active then
      return 'already_staff';
    end if;
    update public.staff_users set is_active = true, role = p_role where user_id = v_staff.user_id;
    return 'reactivated';
  end if;

  insert into public.staff_invites (email, role, invited_by, created_at, accepted_at)
  values (v_email, p_role, v_actor, now(), null)
  on conflict (email) do update
    set role = excluded.role, invited_by = excluded.invited_by, created_at = now(), accepted_at = null;

  select * into v_user from auth.users where lower(email) = lower(v_email::text) limit 1;
  if found then
    insert into public.staff_users (user_id, email, role, display_name, created_by)
    values (v_user.id, v_email, p_role, split_part(v_email::text, '@', 1), v_actor)
    on conflict (user_id) do update set role = excluded.role, is_active = true;
    update public.staff_invites set accepted_at = now() where email = v_email;
    return 'linked';
  end if;
  return 'invited';
end $$;

revoke execute on function public.invite_staff(text, public.staff_role, uuid) from public, anon;
grant execute on function public.invite_staff(text, public.staff_role, uuid) to authenticated, service_role;

-- 3. Policies nach H19 -----------------------------------------------------------------------
drop policy if exists admin_write on public.staff_users;
drop policy if exists owner_write on public.staff_users;
create policy owner_write on public.staff_users for all to authenticated
  using (public.is_staff(array['owner']::public.staff_role[]))
  with check (public.is_staff(array['owner']::public.staff_role[]));

drop policy if exists admin_write on public.staff_invites;
drop policy if exists owner_write on public.staff_invites;
create policy owner_write on public.staff_invites for all to authenticated
  using (public.is_staff(array['owner']::public.staff_role[]))
  with check (public.is_staff(array['owner']::public.staff_role[]));

-- 4. Zugänge laut Entscheidung ---------------------------------------------------------------
insert into public.staff_invites (email, role)
values ('hello@provibe-drinks.de', 'owner'), ('mail@paulschoettler.de', 'admin')
on conflict (email) do update set role = excluded.role;

update public.staff_users s set role = i.role
from public.staff_invites i
where s.email = i.email
  and i.email in ('hello@provibe-drinks.de', 'mail@paulschoettler.de')
  and s.role is distinct from i.role;

-- Auth-Benutzer gibt es schon, aber noch keinen staff_users-Eintrag (Trigger greift nur beim Anlegen)
insert into public.staff_users (user_id, email, role, display_name)
select u.id, i.email, i.role, split_part(i.email::text, '@', 1)
from public.staff_invites i
join auth.users u on lower(u.email) = lower(i.email::text)
where i.email in ('hello@provibe-drinks.de', 'mail@paulschoettler.de')
on conflict (user_id) do nothing;

update public.staff_invites i set accepted_at = coalesce(i.accepted_at, now())
where i.email in ('hello@provibe-drinks.de', 'mail@paulschoettler.de')
  and exists (select 1 from public.staff_users s where s.email = i.email);
