-- Clinical tools: target weight, lab results and the online intake form.

-- ---------------------------------------------------------------------------
-- Target weight (the overview projects when it will be reached)
-- ---------------------------------------------------------------------------

alter table public.patient_health
  add column target_weight_kg numeric(5, 1) check (target_weight_kg between 20 and 400);

-- ---------------------------------------------------------------------------
-- Lab results (HbA1c, lipids, vitamin D...). Same access as measurements:
-- the clinical team edits, the patient can read their own.
-- ---------------------------------------------------------------------------

create table public.lab_results (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  measured_on  date not null,
  -- A key from the app's test list (hba1c, ldl...) or a name for other tests.
  test         text not null check (char_length(trim(test)) between 1 and 60),
  value        numeric(12, 3) not null check (value >= 0 and value < 1000000),
  unit         text not null check (char_length(unit) <= 20),
  note         text check (char_length(note) <= 300),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index lab_results_patient_idx on public.lab_results (patient_id, test, measured_on desc);

alter table public.lab_results enable row level security;
revoke all on public.lab_results from anon;

create policy lab_results_all on public.lab_results for all
  using (public.can_see_clinical(patient_id)) with check (public.can_see_clinical(patient_id));
create policy lab_results_self on public.lab_results for select
  using (public.is_patient_self(patient_id));
