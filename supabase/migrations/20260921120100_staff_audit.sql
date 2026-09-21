-- 0002 Backoffice-Benutzer, Rollen, Audit-Log

create type public.staff_role as enum ('owner', 'admin', 'support', 'fulfillment');

create table public.staff_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        citext not null unique,
  display_name text,
  role         public.staff_role not null default 'support',
  is_active    boolean not null default true,
  mfa_enforced boolean not null default true,
  last_login_at timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Einladungen: Sobald sich eine eingeladene E-Mail bei Supabase Auth registriert,
-- entsteht automatisch der Staff-Eintrag (Trigger in 0005).
create table public.staff_invites (
  email      citext primary key,
  role       public.staff_role not null default 'support',
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_email   text,
  actor_role    text,
  action        text not null,            -- z.B. product.update, order.refund
  entity_type   text not null,
  entity_id     text,
  before        jsonb,
  after         jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id, created_at desc);

-- Rollenprüfung für RLS. SECURITY DEFINER, damit die Abfrage auf staff_users nicht selbst an RLS scheitert.
create or replace function public.is_staff(p_roles public.staff_role[] default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_users s
    where s.user_id = auth.uid()
      and s.is_active
      and (p_roles is null or s.role = any (p_roles))
  );
$$;
revoke execute on function public.is_staff(public.staff_role[]) from public, anon;
grant execute on function public.is_staff(public.staff_role[]) to authenticated, service_role;

create or replace function public.current_staff_role()
returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff_users where user_id = auth.uid() and is_active;
$$;
revoke execute on function public.current_staff_role() from public, anon;
grant execute on function public.current_staff_role() to authenticated, service_role;

-- Owner + Admin dürfen Stammdaten und Einstellungen schreiben
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(array['owner','admin']::public.staff_role[]);
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
