-- Platform super admin, support access and the lab (same model as Gymix).
--
-- Super admins run Nutrix itself. They see per-practice numbers through
-- admin_* functions, never patient data through RLS, unless they open a
-- practice (support access): while a platform_admin_visits row exists they act
-- as that practice's owner, dietitian or assistant. In a lab practice they can
-- also open the patient app with their own patient record.
--
-- Feature switches: off / lab practices only / everyone, plus per-practice
-- exceptions. All admin writes go through SECURITY DEFINER functions, so the
-- web app needs no service-role key for them.

create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

alter table public.practices add column is_lab boolean not null default false;

-- The practice a super admin is in right now, and as whom. One at a time.
create table public.platform_admin_visits (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  practice_id  uuid not null references public.practices (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'dietitian', 'assistant', 'patient')),
  started_at   timestamptz not null default now()
);
alter table public.platform_admin_visits enable row level security;
revoke insert, update, delete on public.platform_admin_visits from authenticated;
revoke all on public.platform_admin_visits from anon;
create policy visits_select_own on public.platform_admin_visits for select using (user_id = auth.uid());

-- Every permission check goes through these, so a visiting super admin gets
-- exactly the role they chose.
create or replace function public.my_practice_role(p_practice_id uuid)
returns public.practice_role
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.practice_users where practice_id = p_practice_id and user_id = auth.uid()),
    (select v.role::public.practice_role from public.platform_admin_visits v
      where v.user_id = auth.uid() and v.practice_id = p_practice_id and v.role <> 'patient' and public.is_platform_admin())
  )
$$;

create or replace function public.can_see_clinical(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.patients p
     where p.id = p_patient_id
       and (public.my_practice_role(p.practice_id) = 'owner'
            or (public.my_practice_role(p.practice_id) = 'dietitian' and p.dietitian_id = auth.uid()))
  )
$$;

-- ---------------------------------------------------------------------------
-- Feature switches
-- ---------------------------------------------------------------------------

create table public.features (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name         text not null,
  description  text not null default '',
  rollout      text not null default 'lab' check (rollout in ('off', 'lab', 'all')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.features enable row level security;
revoke insert, update, delete on public.features from authenticated;
create policy features_select on public.features for select to authenticated using (true);

create table public.practice_feature_overrides (
  practice_id  uuid not null references public.practices (id) on delete cascade,
  feature_key  text not null references public.features (key) on delete cascade on update cascade,
  enabled      boolean not null,
  primary key (practice_id, feature_key)
);
alter table public.practice_feature_overrides enable row level security;
revoke insert, update, delete on public.practice_feature_overrides from authenticated;
create policy overrides_select_admin on public.practice_feature_overrides for select using (public.is_platform_admin());

-- The features on for one practice.
create function public.practice_features(p_practice_id uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(f.key order by f.key), '{}')
    from public.features f
    join public.practices pr on pr.id = p_practice_id
    left join public.practice_feature_overrides o on o.practice_id = pr.id and o.feature_key = f.key
   where coalesce(o.enabled, f.rollout = 'all' or (f.rollout = 'lab' and pr.is_lab))
$$;

-- What's live today stays on for everyone.
insert into public.features (key, name, description, rollout) values
  ('messages', 'Messages', 'Private conversations between patients and their dietitian.', 'all'),
  ('patient_diary', 'Food diary and check-ins', 'Patients log meals, water and a daily check-in in the app.', 'all'),
  ('patient_booking', 'Appointment requests', 'Patients ask for an appointment time from the app.', 'all');

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

create function public.nx_require_platform_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

-- One row per practice with health numbers (no patient data).
create function public.admin_practice_overview()
returns table (
  practice_id      uuid,
  name             text,
  is_lab           boolean,
  created_at       timestamptz,
  owner_name       text,
  owner_email      text,
  staff            integer,
  patients         integer,
  patients_on_app  integer,
  active_plans     integer,
  appointments_30d integer,
  collected_30d    numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.nx_require_platform_admin();
  return query
  select pr.id, pr.name, pr.is_lab, pr.created_at, op.full_name, op.email,
    (select count(*)::integer from public.practice_users pu where pu.practice_id = pr.id),
    (select count(*)::integer from public.patients p where p.practice_id = pr.id and p.archived_at is null),
    (select count(*)::integer from public.patients p where p.practice_id = pr.id and p.archived_at is null and p.user_id is not null),
    (select count(*)::integer from public.meal_plans m join public.patients p on p.id = m.patient_id where p.practice_id = pr.id and m.status = 'active'),
    (select count(*)::integer from public.appointments a where a.practice_id = pr.id and a.status = 'completed' and a.starts_at > now() - interval '30 days'),
    (select coalesce(sum(pa.amount_usd), 0) from public.payments pa where pa.practice_id = pr.id and pa.paid_at > now() - interval '30 days')
  from public.practices pr
  left join lateral (
    select pf.full_name, pf.email from public.practice_users pu join public.profiles pf on pf.id = pu.user_id
     where pu.practice_id = pr.id and pu.role = 'owner' limit 1
  ) op on true
  order by pr.is_lab desc, pr.created_at desc;
end;
$$;

-- Open a practice as a role. 'patient' only in a lab practice: the super admin
-- gets a patient record there the first time.
create function public.admin_open_practice(p_practice_id uuid, p_role text default 'owner')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pr public.practices;
  v_name text;
begin
  perform public.nx_require_platform_admin();
  select * into pr from public.practices where id = p_practice_id;
  if pr.id is null then
    raise exception 'Practice not found.' using errcode = 'P0002';
  end if;
  if p_role not in ('owner', 'dietitian', 'assistant', 'patient') then
    raise exception 'Choose a role.' using errcode = '22023';
  end if;
  if p_role = 'patient' then
    if not pr.is_lab then
      raise exception 'Only a lab practice can be opened as a patient.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.patients where practice_id = pr.id and user_id = auth.uid()) then
      select coalesce(nullif(full_name, ''), 'Lab patient') into v_name from public.profiles where id = auth.uid();
      insert into public.patients (practice_id, user_id, full_name, email)
      values (pr.id, auth.uid(), left(v_name, 120), (select email from public.profiles where id = auth.uid()));
    end if;
  end if;
  insert into public.platform_admin_visits (user_id, practice_id, role, started_at)
  values (auth.uid(), pr.id, p_role, now())
  on conflict (user_id) do update set practice_id = excluded.practice_id, role = excluded.role, started_at = now();
end;
$$;

create function public.admin_leave_practice()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.platform_admin_visits where user_id = auth.uid()
$$;

-- The super admin's own test practice (created once).
create function public.admin_create_lab()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.nx_require_platform_admin();
  select id into v_id from public.practices where is_lab order by created_at limit 1;
  if v_id is null then
    insert into public.practices (name, slug, created_by, is_lab)
    values ('Nutrix Lab', 'nutrix-lab-' || substr(md5(random()::text), 1, 6), auth.uid(), true)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.admin_set_rollout(p_key text, p_rollout text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.nx_require_platform_admin();
  if p_rollout not in ('off', 'lab', 'all') then
    raise exception 'Choose off, lab or all.' using errcode = '22023';
  end if;
  update public.features set rollout = p_rollout, updated_at = now() where key = p_key;
end;
$$;

-- p_value: 'on', 'off', or 'default' (follow the rollout).
create function public.admin_set_override(p_practice_id uuid, p_key text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.nx_require_platform_admin();
  if p_value = 'default' then
    delete from public.practice_feature_overrides where practice_id = p_practice_id and feature_key = p_key;
  elsif p_value in ('on', 'off') then
    insert into public.practice_feature_overrides (practice_id, feature_key, enabled)
    values (p_practice_id, p_key, p_value = 'on')
    on conflict (practice_id, feature_key) do update set enabled = excluded.enabled;
  else
    raise exception 'Choose on, off or default.' using errcode = '22023';
  end if;
end;
$$;

-- Admins can read practice names for the console's pickers.
create policy practices_select_admin on public.practices for select using (public.is_platform_admin());

revoke execute on function public.nx_require_platform_admin() from public, anon, authenticated;
revoke execute on function
  public.is_platform_admin(), public.practice_features(uuid), public.admin_practice_overview(),
  public.admin_open_practice(uuid, text), public.admin_leave_practice(), public.admin_create_lab(),
  public.admin_set_rollout(text, text), public.admin_set_override(uuid, text, text)
  from public, anon;
grant execute on function
  public.is_platform_admin(), public.practice_features(uuid), public.admin_practice_overview(),
  public.admin_open_practice(uuid, text), public.admin_leave_practice(), public.admin_create_lab(),
  public.admin_set_rollout(text, text), public.admin_set_override(uuid, text, text)
  to authenticated;
