-- Phase 2: appointments, business (services, packages, invoices, payments),
-- messages, and the patient's side (food diary, check-ins, water, weight,
-- booking requests).
--
-- Access, in short:
--   scheduling and money: owner + assistant see the whole practice; a dietitian
--     sees appointments with their own patients but no money;
--   diary, check-ins, messages: clinical (owner + assigned dietitian) and the patient.
-- Money changes go through SECURITY DEFINER functions only.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Services and packages (practice catalogue)
-- ---------------------------------------------------------------------------

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  practice_id   uuid not null references public.practices (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 2 and 80),
  duration_min  integer not null default 45 check (duration_min between 5 and 480),
  price_usd     numeric(10, 2) not null default 0 check (price_usd >= 0),
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table public.package_types (
  id             uuid primary key default gen_random_uuid(),
  practice_id    uuid not null references public.practices (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 2 and 80),
  consultations  integer not null check (consultations between 1 and 200),
  price_usd      numeric(10, 2) not null check (price_usd >= 0),
  valid_days     integer not null default 90 check (valid_days between 1 and 1095),
  archived_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- A package sold to a patient (a copy of the package type at the time of sale).
create table public.patient_packages (
  id                   uuid primary key default gen_random_uuid(),
  practice_id          uuid not null references public.practices (id) on delete cascade,
  patient_id           uuid not null references public.patients (id) on delete cascade,
  package_type_id      uuid references public.package_types (id) on delete set null,
  name                 text not null,
  consultations_total  integer not null check (consultations_total between 1 and 200),
  price_usd            numeric(10, 2) not null check (price_usd >= 0),
  starts_on            date not null default current_date,
  expires_on           date not null,
  cancelled_at         timestamptz,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  check (expires_on >= starts_on)
);

create index patient_packages_patient_idx on public.patient_packages (patient_id);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'no_show', 'cancelled');

create table public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  practice_id         uuid not null references public.practices (id) on delete cascade,
  patient_id          uuid not null references public.patients (id) on delete cascade,
  dietitian_id        uuid references public.profiles (id) on delete set null,
  service_id          uuid references public.services (id) on delete set null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              public.appointment_status not null default 'confirmed',
  online              boolean not null default false,
  -- Practice-side note (not clinical): "first visit, bring lab results".
  note                text check (char_length(note) <= 500),
  -- What the patient wrote when asking for the appointment.
  patient_note        text check (char_length(patient_note) <= 500),
  cancel_reason       text check (char_length(cancel_reason) <= 300),
  -- Consultation counted against this package (set when completed).
  patient_package_id  uuid references public.patient_packages (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  -- A dietitian can't be booked twice at the same time.
  constraint appointments_no_overlap exclude using gist (
    dietitian_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status in ('requested', 'confirmed') and dietitian_id is not null)
);

create index appointments_practice_time_idx on public.appointments (practice_id, starts_at);
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);

alter table public.consultation_notes add column appointment_id uuid references public.appointments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Invoices and payments (USD; LBP cash recorded with the rate of the day)
-- ---------------------------------------------------------------------------

create type public.payment_method as enum ('cash_usd', 'cash_lbp', 'card', 'transfer', 'whish', 'omt');

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  practice_id         uuid not null references public.practices (id) on delete cascade,
  patient_id          uuid not null references public.patients (id) on delete cascade,
  number              integer not null,
  issued_on           date not null default current_date,
  description         text not null check (char_length(trim(description)) between 1 and 200),
  amount_usd          numeric(10, 2) not null check (amount_usd >= 0),
  patient_package_id  uuid references public.patient_packages (id) on delete set null,
  appointment_id      uuid references public.appointments (id) on delete set null,
  voided_at           timestamptz,
  void_reason         text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (practice_id, number)
);

create index invoices_patient_idx on public.invoices (patient_id);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  amount_usd   numeric(10, 2) not null check (amount_usd > 0),
  method       public.payment_method not null,
  lbp_amount   numeric(14, 0),
  lbp_rate     numeric(12, 2),
  paid_at      timestamptz not null default now(),
  received_by  uuid references public.profiles (id) on delete set null,
  note         text check (char_length(note) <= 200)
);

create index payments_invoice_idx on public.payments (invoice_id);
create index payments_practice_time_idx on public.payments (practice_id, paid_at);

-- What each invoice still owes.
create view public.invoice_balances with (security_invoker = true) as
  select i.id as invoice_id, i.practice_id, i.patient_id, i.amount_usd,
         coalesce((select sum(p.amount_usd) from public.payments p where p.invoice_id = i.id), 0) as paid_usd,
         case when i.voided_at is null
              then i.amount_usd - coalesce((select sum(p.amount_usd) from public.payments p where p.invoice_id = i.id), 0)
              else 0 end as due_usd
    from public.invoices i;

-- Consultations used and left on each package.
create view public.package_usage with (security_invoker = true) as
  select pp.id as patient_package_id, pp.patient_id, pp.practice_id,
         (select count(*) from public.appointments a where a.patient_package_id = pp.id and a.status = 'completed')::integer as used,
         pp.consultations_total - (select count(*) from public.appointments a where a.patient_package_id = pp.id and a.status = 'completed')::integer as remaining
    from public.patient_packages pp;

-- ---------------------------------------------------------------------------
-- Messages: one thread per patient, between the patient and their clinicians
-- ---------------------------------------------------------------------------

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  sender_id     uuid references public.profiles (id) on delete set null,
  from_patient  boolean not null,
  body          text not null check (char_length(trim(body)) between 1 and 4000),
  created_at    timestamptz not null default now(),
  -- When the other side read it.
  read_at       timestamptz
);

create index messages_patient_idx on public.messages (patient_id, created_at);

-- ---------------------------------------------------------------------------
-- Patient diary, check-ins, water
-- ---------------------------------------------------------------------------

create type public.diary_source as enum ('search', 'plan', 'swap');

create table public.diary_entries (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  eaten_on     date not null,
  slot         text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id      uuid references public.foods (id) on delete set null,
  name         text not null,
  grams        numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  serving      jsonb,
  kcal         numeric(7, 1) not null,
  protein_g    numeric(6, 1) not null,
  carbs_g      numeric(6, 1) not null,
  fat_g        numeric(6, 1) not null,
  fiber_g      numeric(6, 1),
  source       public.diary_source not null default 'search',
  plan_meal_key text,
  created_at   timestamptz not null default now()
);

create index diary_patient_day_idx on public.diary_entries (patient_id, eaten_on);

create table public.daily_checkins (
  patient_id    uuid not null references public.patients (id) on delete cascade,
  day           date not null,
  mood          smallint check (mood between 1 and 5),
  energy        smallint check (energy between 1 and 5),
  hunger        smallint check (hunger between 1 and 5),
  sleep_hours   numeric(3, 1) check (sleep_hours between 0 and 24),
  followed_plan smallint check (followed_plan between 1 and 5),
  note          text check (char_length(note) <= 500),
  water_ml      integer not null default 0 check (water_ml between 0 and 10000),
  checked_in_at timestamptz,
  primary key (patient_id, day)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_billing(p_practice_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_practice_role(p_practice_id) in ('owner', 'assistant'), false)
$$;

-- The patient record of the signed-in patient (their first practice).
create function public.my_patient_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.patients where user_id = auth.uid() and archived_at is null order by created_at limit 1
$$;

-- Patients can find foods of their own practice too (to log plan foods).
drop policy foods_select on public.foods;
create policy foods_select on public.foods for select
  using (
    practice_id is null
    or public.is_practice_staff(practice_id)
    or exists (select 1 from public.patients p where p.user_id = auth.uid() and p.practice_id = foods.practice_id and p.archived_at is null)
  );

create or replace function public.can_use_food(p_food_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.foods f
     where f.id = p_food_id
       and (f.practice_id is null or public.is_practice_staff(f.practice_id)
            or exists (select 1 from public.patients p where p.user_id = auth.uid() and p.practice_id = f.practice_id and p.archived_at is null))
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.services         enable row level security;
alter table public.package_types    enable row level security;
alter table public.patient_packages enable row level security;
alter table public.appointments     enable row level security;
alter table public.invoices         enable row level security;
alter table public.payments         enable row level security;
alter table public.messages         enable row level security;
alter table public.diary_entries    enable row level security;
alter table public.daily_checkins   enable row level security;

revoke all on public.services, public.package_types, public.patient_packages, public.appointments, public.invoices,
  public.payments, public.messages, public.diary_entries, public.daily_checkins, public.invoice_balances, public.package_usage from anon;

-- Catalogue: every staff role reads (to book); owner edits.
create policy services_select on public.services for select using (public.is_practice_staff(practice_id));
create policy services_write on public.services for all
  using (public.my_practice_role(practice_id) = 'owner') with check (public.my_practice_role(practice_id) = 'owner');
create policy package_types_select on public.package_types for select using (public.is_practice_staff(practice_id));
create policy package_types_write on public.package_types for all
  using (public.my_practice_role(practice_id) = 'owner') with check (public.my_practice_role(practice_id) = 'owner');

-- Packages: billing staff, the patient's clinicians (to see what's left) and the patient.
revoke insert, update, delete on public.patient_packages from authenticated;
create policy patient_packages_select on public.patient_packages for select
  using (public.is_billing(practice_id) or public.can_see_clinical(patient_id) or public.is_patient_self(patient_id));

-- Appointments: written through functions; read by billing staff, the dietitian
-- whose patient it is or who holds the appointment, and the patient.
revoke insert, update, delete on public.appointments from authenticated;
create policy appointments_select on public.appointments for select
  using (
    public.is_billing(practice_id)
    or dietitian_id = auth.uid()
    or public.can_see_clinical(patient_id)
    or public.is_patient_self(patient_id)
  );

-- Money: billing staff only (owner + assistant).
revoke insert, update, delete on public.invoices, public.payments from authenticated;
create policy invoices_select on public.invoices for select using (public.is_billing(practice_id));
create policy payments_select on public.payments for select using (public.is_billing(practice_id));

-- Messages: the patient and their clinicians.
revoke update, delete on public.messages from authenticated;
create policy messages_select on public.messages for select
  using (public.can_see_clinical(patient_id) or public.is_patient_self(patient_id));
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid() and read_at is null and (
      (from_patient and public.is_patient_self(patient_id))
      or (not from_patient and public.can_see_clinical(patient_id))
    )
  );

-- Diary: the patient writes (through log functions) and deletes their own; clinicians read.
revoke insert, update on public.diary_entries from authenticated;
create policy diary_select on public.diary_entries for select
  using (public.can_see_clinical(patient_id) or public.is_patient_self(patient_id));
create policy diary_delete on public.diary_entries for delete using (public.is_patient_self(patient_id));

create policy checkins_select on public.daily_checkins for select
  using (public.can_see_clinical(patient_id) or public.is_patient_self(patient_id));
create policy checkins_write on public.daily_checkins for insert
  with check (public.is_patient_self(patient_id));
create policy checkins_update on public.daily_checkins for update
  using (public.is_patient_self(patient_id)) with check (public.is_patient_self(patient_id));

-- Patients may record their own weight (source 'patient').
create policy measurements_self_insert on public.measurements for insert
  with check (public.is_patient_self(patient_id) and source = 'patient' and recorded_by = auth.uid());

create trigger appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

-- Booked by staff. Assistants and the owner book for anyone; a dietitian for their own patients.
create function public.book_appointment(
  p_patient_id uuid, p_starts_at timestamptz, p_duration_min integer default null,
  p_service_id uuid default null, p_dietitian_id uuid default null, p_online boolean default false, p_note text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pt public.patients;
  v_role public.practice_role;
  v_duration integer;
  v_dietitian uuid;
  v_id uuid;
begin
  select * into pt from public.patients where id = p_patient_id and archived_at is null;
  if pt.id is null then
    raise exception 'Patient not found.' using errcode = 'P0002';
  end if;
  v_role := public.my_practice_role(pt.practice_id);
  if v_role is null or (v_role = 'dietitian' and pt.dietitian_id is distinct from auth.uid()) then
    raise exception 'You can''t book for this patient.' using errcode = '42501';
  end if;
  select coalesce(p_duration_min, s.duration_min, 45) into v_duration
    from (select 1) x left join public.services s on s.id = p_service_id and s.practice_id = pt.practice_id;
  v_dietitian := case when v_role = 'dietitian' then auth.uid() else coalesce(p_dietitian_id, pt.dietitian_id) end;
  if v_dietitian is not null and not exists (
    select 1 from public.practice_users where practice_id = pt.practice_id and user_id = v_dietitian and role in ('owner', 'dietitian')
  ) then
    raise exception 'Choose a dietitian from your practice.' using errcode = '22023';
  end if;

  insert into public.appointments (practice_id, patient_id, dietitian_id, service_id, starts_at, ends_at, online, note, created_by)
  values (pt.practice_id, pt.id, v_dietitian, p_service_id, p_starts_at, p_starts_at + make_interval(mins => v_duration),
          coalesce(p_online, false), nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
exception when exclusion_violation then
  raise exception 'The dietitian already has an appointment at that time.' using errcode = '22023';
end;
$$;

-- The patient asks for a time; the practice confirms or proposes another.
create function public.request_appointment(p_starts_at timestamptz, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pt public.patients;
  v_id uuid;
begin
  select * into pt from public.patients where id = public.my_patient_id();
  if pt.id is null then
    raise exception 'Only patients can request appointments.' using errcode = '42501';
  end if;
  if p_starts_at < now() then
    raise exception 'Choose a time in the future.' using errcode = '22023';
  end if;
  if (select count(*) from public.appointments where patient_id = pt.id and status = 'requested') >= 3 then
    raise exception 'You already have requests waiting. Your dietitian will reply soon.' using errcode = '22023';
  end if;
  insert into public.appointments (practice_id, patient_id, dietitian_id, starts_at, ends_at, status, patient_note, created_by)
  values (pt.practice_id, pt.id, pt.dietitian_id, p_starts_at, p_starts_at + interval '45 minutes', 'requested',
          nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
exception when exclusion_violation then
  raise exception 'That time is taken. Please choose another.' using errcode = '22023';
end;
$$;

-- Staff may change an appointment they can see (and are allowed to book).
create function public.nx_can_manage_appointment(a public.appointments)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_billing(a.practice_id) or a.dietitian_id = auth.uid()
      or (public.my_practice_role(a.practice_id) = 'dietitian' and public.can_see_clinical(a.patient_id))
$$;

create function public.reschedule_appointment(p_id uuid, p_starts_at timestamptz, p_duration_min integer default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or not public.nx_can_manage_appointment(a) then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;
  if a.status not in ('requested', 'confirmed') then
    raise exception 'Only upcoming appointments can be moved.' using errcode = '22023';
  end if;
  update public.appointments
     set starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => coalesce(p_duration_min, (extract(epoch from (a.ends_at - a.starts_at)) / 60)::integer)),
         status = 'confirmed'
   where id = p_id;
exception when exclusion_violation then
  raise exception 'The dietitian already has an appointment at that time.' using errcode = '22023';
end;
$$;

create function public.confirm_appointment(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or not public.nx_can_manage_appointment(a) then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;
  update public.appointments set status = 'confirmed' where id = p_id and status = 'requested';
end;
$$;

-- Cancelled by staff, or by the patient for their own upcoming appointment.
create function public.cancel_appointment(p_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or not (public.nx_can_manage_appointment(a) or public.is_patient_self(a.patient_id)) then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;
  if a.status not in ('requested', 'confirmed') then
    raise exception 'This appointment is already closed.' using errcode = '22023';
  end if;
  update public.appointments set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = p_id;
end;
$$;

-- Attendance. Completed: counts against the patient's package (soonest to
-- expire, with consultations left) or, without one, bills the service price.
-- Returns the invoice id when one was created.
create function public.complete_appointment(p_id uuid, p_attended boolean default true, p_bill boolean default true)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  a public.appointments;
  v_package uuid;
  v_price numeric;
  v_service text;
  v_invoice uuid;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null or not public.nx_can_manage_appointment(a) then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;
  if a.status not in ('requested', 'confirmed') then
    raise exception 'Attendance is already recorded.' using errcode = '22023';
  end if;
  -- Attendance is recorded on the day of the appointment or later.
  if (a.starts_at at time zone (select timezone from public.practices where id = a.practice_id))::date
     > (now() at time zone (select timezone from public.practices where id = a.practice_id))::date then
    raise exception 'Attendance can be recorded from the day of the appointment.' using errcode = '22023';
  end if;
  if not p_attended then
    update public.appointments set status = 'no_show' where id = p_id;
    return null;
  end if;

  select pp.id into v_package
    from public.patient_packages pp join public.package_usage u on u.patient_package_id = pp.id
   where pp.patient_id = a.patient_id and pp.cancelled_at is null and u.remaining > 0
     and (a.starts_at at time zone (select timezone from public.practices where id = a.practice_id))::date between pp.starts_on and pp.expires_on
   order by pp.expires_on, pp.created_at
   limit 1;

  update public.appointments set status = 'completed', patient_package_id = v_package where id = p_id;

  if v_package is null and p_bill then
    select s.price_usd, s.name into v_price, v_service from public.services s where s.id = a.service_id;
    if coalesce(v_price, 0) > 0 then
      insert into public.invoices (practice_id, patient_id, number, description, amount_usd, appointment_id, created_by)
      values (a.practice_id, a.patient_id, public.nx_next_invoice_number(a.practice_id),
              v_service || ' on ' || to_char(a.starts_at at time zone (select timezone from public.practices where id = a.practice_id), 'DD Mon YYYY'), v_price, a.id, auth.uid())
      returning id into v_invoice;
    end if;
  end if;
  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create function public.nx_next_invoice_number(p_practice_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('nx_invoice_' || p_practice_id::text));
  return coalesce((select max(number) from public.invoices where practice_id = p_practice_id), 0) + 1;
end;
$$;

-- Sells a package: the patient's package plus its invoice. Returns the invoice id.
create function public.sell_package(p_patient_id uuid, p_package_type_id uuid, p_starts_on date default null, p_price_usd numeric default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pt public.patients;
  t public.package_types;
  v_start date := coalesce(p_starts_on, current_date);
  v_pp uuid;
  v_invoice uuid;
begin
  select * into pt from public.patients where id = p_patient_id;
  if pt.id is null or not public.is_billing(pt.practice_id) then
    raise exception 'Only the owner or an assistant can sell packages.' using errcode = '42501';
  end if;
  select * into t from public.package_types where id = p_package_type_id and practice_id = pt.practice_id and archived_at is null;
  if t.id is null then
    raise exception 'Package not found.' using errcode = 'P0002';
  end if;
  if p_price_usd is not null and p_price_usd < 0 then
    raise exception 'Price can''t be negative.' using errcode = '22023';
  end if;
  insert into public.patient_packages (practice_id, patient_id, package_type_id, name, consultations_total, price_usd, starts_on, expires_on, created_by)
  values (pt.practice_id, pt.id, t.id, t.name, t.consultations, coalesce(p_price_usd, t.price_usd), v_start, v_start + t.valid_days - 1, auth.uid())
  returning id into v_pp;
  insert into public.invoices (practice_id, patient_id, number, description, amount_usd, patient_package_id, created_by)
  values (pt.practice_id, pt.id, public.nx_next_invoice_number(pt.practice_id), t.name || ' (' || t.consultations || ' consultations)',
          coalesce(p_price_usd, t.price_usd), v_pp, auth.uid())
  returning id into v_invoice;
  return v_invoice;
end;
$$;

-- A one-off charge (e.g. a body composition test).
create function public.create_invoice(p_patient_id uuid, p_description text, p_amount_usd numeric)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pt public.patients;
  v_id uuid;
begin
  select * into pt from public.patients where id = p_patient_id;
  if pt.id is null or not public.is_billing(pt.practice_id) then
    raise exception 'Only the owner or an assistant can bill.' using errcode = '42501';
  end if;
  if coalesce(p_amount_usd, 0) <= 0 then
    raise exception 'Enter an amount.' using errcode = '22023';
  end if;
  insert into public.invoices (practice_id, patient_id, number, description, amount_usd, created_by)
  values (pt.practice_id, pt.id, public.nx_next_invoice_number(pt.practice_id), trim(p_description), round(p_amount_usd, 2), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Records a payment. For LBP cash, give the LBP amount; the USD value uses the practice rate.
create function public.record_payment(
  p_invoice_id uuid, p_method public.payment_method, p_amount_usd numeric default null,
  p_lbp_amount numeric default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  i public.invoices;
  v_due numeric;
  v_rate numeric;
  v_usd numeric;
  v_id uuid;
begin
  select * into i from public.invoices where id = p_invoice_id for update;
  if i.id is null or not public.is_billing(i.practice_id) then
    raise exception 'Invoice not found.' using errcode = 'P0002';
  end if;
  if i.voided_at is not null then
    raise exception 'This invoice was voided.' using errcode = '22023';
  end if;
  select due_usd into v_due from public.invoice_balances where invoice_id = i.id;
  if p_method = 'cash_lbp' then
    select lbp_rate into v_rate from public.practices where id = i.practice_id;
    if coalesce(p_lbp_amount, 0) <= 0 then
      raise exception 'Enter the amount in LBP.' using errcode = '22023';
    end if;
    v_usd := round(p_lbp_amount / v_rate, 2);
  else
    v_usd := round(coalesce(p_amount_usd, 0), 2);
  end if;
  if v_usd <= 0 then
    raise exception 'Enter an amount.' using errcode = '22023';
  end if;
  if v_usd > v_due + 0.01 then
    raise exception 'That is more than the % USD still due.', v_due using errcode = '22023';
  end if;
  insert into public.payments (practice_id, invoice_id, amount_usd, method, lbp_amount, lbp_rate, received_by, note)
  values (i.practice_id, i.id, least(v_usd, v_due), p_method,
          case when p_method = 'cash_lbp' then p_lbp_amount end, case when p_method = 'cash_lbp' then v_rate end,
          auth.uid(), nullif(trim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Refund: removes a payment.
create function public.refund_payment(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.payments where id = p_payment_id and public.is_billing(practice_id);
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Void: the invoice stays (numbering has no gaps) but owes nothing. Refund payments first.
-- Voiding a package invoice cancels the package.
create function public.void_invoice(p_invoice_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  i public.invoices;
begin
  select * into i from public.invoices where id = p_invoice_id for update;
  if i.id is null or not public.is_billing(i.practice_id) then
    raise exception 'Invoice not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.payments where invoice_id = i.id) then
    raise exception 'Refund the payments on this invoice first.' using errcode = '22023';
  end if;
  update public.invoices set voided_at = now(), void_reason = nullif(trim(p_reason), '') where id = i.id and voided_at is null;
  if i.patient_package_id is not null then
    update public.patient_packages set cancelled_at = now() where id = i.patient_package_id and cancelled_at is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

-- Marks the other side's messages in this thread as read.
create function public.mark_thread_read(p_patient_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_patient_self(p_patient_id) then
    update public.messages set read_at = now() where patient_id = p_patient_id and not from_patient and read_at is null;
  elsif public.can_see_clinical(p_patient_id) then
    update public.messages set read_at = now() where patient_id = p_patient_id and from_patient and read_at is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Diary (numbers from the food database, like plans)
-- ---------------------------------------------------------------------------

create function public.log_food(
  p_eaten_on date, p_slot text, p_food_id uuid, p_grams numeric, p_serving jsonb default null,
  p_source public.diary_source default 'search', p_plan_meal_key text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient uuid := public.my_patient_id();
  f public.foods;
  g numeric := round(p_grams, 1);
  v_id uuid;
begin
  if v_patient is null then
    raise exception 'Only patients keep a food diary.' using errcode = '42501';
  end if;
  if p_eaten_on > current_date + 1 or p_eaten_on < current_date - 30 then
    raise exception 'You can log today or the last 30 days.' using errcode = '22023';
  end if;
  if p_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'Choose a meal.' using errcode = '22023';
  end if;
  select * into f from public.foods where id = p_food_id;
  if f.id is null or not public.can_use_food(f.id) then
    raise exception 'Food not found.' using errcode = 'P0002';
  end if;
  if g is null or g <= 0 or g > 5000 then
    raise exception 'Enter how much you ate.' using errcode = '22023';
  end if;
  insert into public.diary_entries (patient_id, eaten_on, slot, food_id, name, grams, serving, kcal, protein_g, carbs_g, fat_g, fiber_g, source, plan_meal_key)
  values (v_patient, p_eaten_on, p_slot, f.id, f.name, g, p_serving,
          round(f.kcal * g / 100, 1), round(f.protein_g * g / 100, 1), round(f.carbs_g * g / 100, 1), round(f.fat_g * g / 100, 1),
          round(f.fiber_g * g / 100, 1), coalesce(p_source, 'search'), p_plan_meal_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- Water: adds (or removes, with a negative amount) millilitres for the day.
create function public.add_water(p_day date, p_ml integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient uuid := public.my_patient_id();
  v_total integer;
begin
  if v_patient is null then
    raise exception 'Only patients track water.' using errcode = '42501';
  end if;
  insert into public.daily_checkins (patient_id, day, water_ml)
  values (v_patient, p_day, greatest(0, least(10000, p_ml)))
  on conflict (patient_id, day) do update set water_ml = greatest(0, least(10000, public.daily_checkins.water_ml + p_ml))
  returning water_ml into v_total;
  return v_total;
end;
$$;

create function public.save_checkin(
  p_day date, p_mood integer default null, p_energy integer default null, p_hunger integer default null,
  p_sleep_hours numeric default null, p_followed_plan integer default null, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient uuid := public.my_patient_id();
begin
  if v_patient is null then
    raise exception 'Only patients check in.' using errcode = '42501';
  end if;
  insert into public.daily_checkins (patient_id, day, mood, energy, hunger, sleep_hours, followed_plan, note, checked_in_at)
  values (v_patient, p_day, p_mood, p_energy, p_hunger, p_sleep_hours, p_followed_plan, nullif(trim(p_note), ''), now())
  on conflict (patient_id, day) do update
    set mood = excluded.mood, energy = excluded.energy, hunger = excluded.hunger, sleep_hours = excluded.sleep_hours,
        followed_plan = excluded.followed_plan, note = excluded.note, checked_in_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.nx_next_invoice_number(uuid), public.nx_can_manage_appointment(public.appointments) from public, anon, authenticated;
revoke execute on function
  public.book_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text),
  public.request_appointment(timestamptz, text),
  public.reschedule_appointment(uuid, timestamptz, integer),
  public.confirm_appointment(uuid),
  public.cancel_appointment(uuid, text),
  public.complete_appointment(uuid, boolean, boolean),
  public.sell_package(uuid, uuid, date, numeric),
  public.create_invoice(uuid, text, numeric),
  public.record_payment(uuid, public.payment_method, numeric, numeric, text),
  public.refund_payment(uuid),
  public.void_invoice(uuid, text),
  public.mark_thread_read(uuid),
  public.log_food(date, text, uuid, numeric, jsonb, public.diary_source, text),
  public.add_water(date, integer),
  public.save_checkin(date, integer, integer, integer, numeric, integer, text)
  from public, anon;
grant execute on function
  public.book_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text),
  public.request_appointment(timestamptz, text),
  public.reschedule_appointment(uuid, timestamptz, integer),
  public.confirm_appointment(uuid),
  public.cancel_appointment(uuid, text),
  public.complete_appointment(uuid, boolean, boolean),
  public.sell_package(uuid, uuid, date, numeric),
  public.create_invoice(uuid, text, numeric),
  public.record_payment(uuid, public.payment_method, numeric, numeric, text),
  public.refund_payment(uuid),
  public.void_invoice(uuid, text),
  public.mark_thread_read(uuid),
  public.log_food(date, text, uuid, numeric, jsonb, public.diary_source, text),
  public.add_water(date, integer),
  public.save_checkin(date, integer, integer, integer, numeric, integer, text)
  to authenticated;
