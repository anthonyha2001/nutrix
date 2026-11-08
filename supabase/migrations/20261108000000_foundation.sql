-- Nutrix foundation: practices, profiles, staff roles, staff invites, patients.
--
-- Tenancy model: every practice-owned row carries a practice_id, and RLS checks
-- the caller's role in that practice via practice_users. Patients are not staff:
-- a patient is a row in `patients`, optionally linked to a login (user_id) for
-- the Nutrix Patient app.
--
-- Clinical separation: the owner sees every patient in the practice; a
-- dietitian sees the patients assigned to them; an assistant sees patient
-- contact details (for booking and billing) but never clinical records. Clinical
-- tables added later must gate on can_see_clinical(patient_id), not on role.
--
-- Mutations that need to bypass RLS (creating a practice, claiming invites,
-- linking a patient login) go through SECURITY DEFINER functions.

create type public.practice_role as enum ('owner', 'dietitian', 'assistant');
create type public.sex as enum ('female', 'male');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.practices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 80),
  slug        text not null unique,
  timezone    text not null default 'Asia/Beirut',
  -- Prices are kept in USD; LBP cash is recorded with the practice's rate.
  lbp_rate    numeric(12, 2) not null default 89500 check (lbp_rate > 0),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Copied from auth.users (kept in sync by trigger) so staff can see it via RLS.
  email       text not null default '',
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One role per staff user per practice.
create table public.practice_users (
  practice_id  uuid not null references public.practices (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.practice_role not null,
  created_at   timestamptz not null default now(),
  primary key (practice_id, user_id)
);

create index practice_users_user_id_idx on public.practice_users (user_id);

-- Staff invites only. Patients are invited through their patient record.
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices (id) on delete cascade,
  email        text not null check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role         public.practice_role not null check (role <> 'owner'),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

create unique index invites_open_unique on public.invites (practice_id, email) where accepted_at is null;

create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  practice_id    uuid not null references public.practices (id) on delete cascade,
  -- The dietitian responsible for this patient (null = owner only, until assigned).
  dietitian_id   uuid references public.profiles (id) on delete set null,
  -- Set once the patient has a Nutrix Patient login.
  user_id        uuid references public.profiles (id) on delete set null,
  full_name      text not null check (char_length(trim(full_name)) between 2 and 120),
  email          text check (email is null or email = lower(email)),
  phone          text check (char_length(phone) <= 30),
  date_of_birth  date,
  sex            public.sex,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

create index patients_practice_idx on public.patients (practice_id) where archived_at is null;
create index patients_dietitian_idx on public.patients (dietitian_id);
create unique index patients_user_unique on public.patients (practice_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies don't recurse)
-- ---------------------------------------------------------------------------

create function public.my_practice_role(p_practice_id uuid)
returns public.practice_role
language sql stable security definer set search_path = ''
as $$
  select role from public.practice_users where practice_id = p_practice_id and user_id = auth.uid()
$$;

create function public.is_practice_staff(p_practice_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_practice_role(p_practice_id) is not null
$$;

-- Clinical access to one patient: the owner, or the assigned dietitian.
create function public.can_see_clinical(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.patients p
      join public.practice_users pu on pu.practice_id = p.practice_id and pu.user_id = auth.uid()
     where p.id = p_patient_id
       and (pu.role = 'owner' or (pu.role = 'dietitian' and p.dietitian_id = auth.uid()))
  )
$$;

-- The patient themself (signed in to Nutrix Patient).
create function public.is_patient_self(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.patients where id = p_patient_id and user_id = auth.uid() and archived_at is null)
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.practices      enable row level security;
alter table public.profiles       enable row level security;
alter table public.practice_users enable row level security;
alter table public.invites        enable row level security;
alter table public.patients       enable row level security;

revoke all on public.practices, public.profiles, public.practice_users, public.invites, public.patients from anon;
revoke update, insert on public.practices, public.profiles, public.practice_users from authenticated;
revoke update on public.invites, public.patients from authenticated;
grant update (name, timezone, lbp_rate) on public.practices to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (role) on public.practice_users to authenticated;
grant update (dietitian_id, full_name, email, phone, date_of_birth, sex, archived_at) on public.patients to authenticated;

create policy practices_select on public.practices for select
  using (public.is_practice_staff(id));
create policy practices_update on public.practices for update
  using (public.my_practice_role(id) = 'owner')
  with check (public.my_practice_role(id) = 'owner');

-- You see your own profile; staff see colleagues and their practice's patients.
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.practice_users pu where pu.user_id = profiles.id and public.is_practice_staff(pu.practice_id))
    or exists (select 1 from public.patients p where p.user_id = profiles.id and public.is_practice_staff(p.practice_id))
  );
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy practice_users_select on public.practice_users for select
  using (user_id = auth.uid() or public.is_practice_staff(practice_id));
-- Only the owner manages the team, and never their own row.
create policy practice_users_update on public.practice_users for update
  using (user_id <> auth.uid() and public.my_practice_role(practice_id) = 'owner')
  with check (role <> 'owner');
create policy practice_users_delete on public.practice_users for delete
  using (user_id <> auth.uid() and public.my_practice_role(practice_id) = 'owner');

create policy invites_select on public.invites for select
  using (public.my_practice_role(practice_id) = 'owner');
create policy invites_insert on public.invites for insert
  with check (public.my_practice_role(practice_id) = 'owner' and invited_by = auth.uid() and accepted_at is null);
create policy invites_delete on public.invites for delete
  using (accepted_at is null and public.my_practice_role(practice_id) = 'owner');

-- Patients: every staff role sees contact details (assistants book and bill);
-- a dietitian sees only their own patients; the patient sees their own row.
create policy patients_select on public.patients for select
  using (
    public.my_practice_role(practice_id) in ('owner', 'assistant')
    or (public.my_practice_role(practice_id) = 'dietitian' and dietitian_id = auth.uid())
    or user_id = auth.uid()
  );
create policy patients_insert on public.patients for insert
  with check (
    public.my_practice_role(practice_id) in ('owner', 'assistant')
    or (public.my_practice_role(practice_id) = 'dietitian' and dietitian_id = auth.uid())
  );
create policy patients_update on public.patients for update
  using (
    public.my_practice_role(practice_id) in ('owner', 'assistant')
    or (public.my_practice_role(practice_id) = 'dietitian' and dietitian_id = auth.uid())
  )
  -- The assigned dietitian must be a dietitian or owner of this practice.
  with check (
    (dietitian_id is null or exists (
      select 1 from public.practice_users pu
       where pu.practice_id = patients.practice_id and pu.user_id = patients.dietitian_id and pu.role in ('owner', 'dietitian')
    ))
    and (
      public.my_practice_role(practice_id) in ('owner', 'assistant')
      or (public.my_practice_role(practice_id) = 'dietitian' and dietitian_id = auth.uid())
    )
  );
create policy patients_delete on public.patients for delete
  using (public.my_practice_role(practice_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger patients_touch_updated_at before update on public.patients
  for each row execute function public.touch_updated_at();

-- Open staff invites for this email become practice roles, and patient records
-- with this email (and no login yet) are linked to the account.
create function public.claim_for(p_user_id uuid, p_email text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  staff integer;
  linked integer;
begin
  with open_invites as (
    update public.invites set accepted_at = now()
     where email = lower(p_email) and accepted_at is null
    returning practice_id, role
  )
  insert into public.practice_users (practice_id, user_id, role)
  select practice_id, p_user_id, role from open_invites
  on conflict (practice_id, user_id) do nothing;
  get diagnostics staff = row_count;

  update public.patients p set user_id = p_user_id
   where p.email = lower(p_email) and p.user_id is null and p.archived_at is null
     and not exists (select 1 from public.patients q where q.practice_id = p.practice_id and q.user_id = p_user_id);
  get diagnostics linked = row_count;

  return staff + linked;
end;
$$;

create function public.claim_mine()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;
  return public.claim_for(auth.uid(), v_email);
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120));
  if new.email is not null then
    perform public.claim_for(new.id, new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Creates a practice with the caller as owner. Returns the new practice id.
create function public.create_practice(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id   uuid;
  v_base text;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Practice name must be between 2 and 80 characters.' using errcode = '22023';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'practice';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.practices where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.practices (name, slug, created_by) values (trim(p_name), v_slug, auth.uid())
  returning id into v_id;
  insert into public.practice_users (practice_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

revoke execute on function public.claim_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.create_practice(text) from public, anon;
revoke execute on function public.claim_mine() from public, anon;
grant execute on function public.create_practice(text) to authenticated;
grant execute on function public.claim_mine() to authenticated;
