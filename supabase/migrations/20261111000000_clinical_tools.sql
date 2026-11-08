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

-- ---------------------------------------------------------------------------
-- Online intake form. The dietitian sends a link; the patient answers before
-- the first visit, without an account. The link is a long random token, valid
-- for 14 days and for one submission. Answers fill the patient's file where it
-- is still empty and are kept as submitted for the dietitian to review.
-- ---------------------------------------------------------------------------

create table public.intake_forms (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  token         text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '14 days',
  submitted_at  timestamptz,
  answers       jsonb
);

create index intake_forms_patient_idx on public.intake_forms (patient_id, created_at desc);

alter table public.intake_forms enable row level security;
revoke all on public.intake_forms from anon;
revoke insert, update, delete on public.intake_forms from authenticated;
create policy intake_forms_select on public.intake_forms for select using (public.can_see_clinical(patient_id));

-- A link for the patient: the open one if there is one, else a new one.
create function public.intake_create(p_patient_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_token text;
begin
  if not public.can_see_clinical(p_patient_id) then
    raise exception 'You can''t send this patient a form.' using errcode = '42501';
  end if;
  select token into v_token from public.intake_forms
   where patient_id = p_patient_id and submitted_at is null and expires_at > now() + interval '2 days'
   order by created_at desc limit 1;
  if v_token is null then
    insert into public.intake_forms (patient_id, created_by) values (p_patient_id, auth.uid()) returning token into v_token;
  end if;
  return v_token;
end;
$$;

-- What the form page shows. Only the first name and practice: the link must
-- not reveal the patient's file to whoever holds it.
create function public.intake_get(p_token text)
returns table (first_name text, practice_name text, status text)
language sql stable security definer set search_path = ''
as $$
  select split_part(p.full_name, ' ', 1), pr.name,
         case when f.submitted_at is not null then 'submitted' when f.expires_at < now() then 'expired' else 'open' end
    from public.intake_forms f
    join public.patients p on p.id = f.patient_id
    join public.practices pr on pr.id = p.practice_id
   where f.token = p_token and p.archived_at is null
$$;

-- Labels for the free-text answers, in the order they are written into the file.
create function public.intake_lines(a jsonb, keys text[], labels text[])
returns text language sql immutable set search_path = ''
as $$
  select nullif(string_agg(labels[i] || ': ' || trim(a ->> keys[i]), e'\n' order by i), '')
    from generate_subscripts(keys, 1) i
   where nullif(trim(a ->> keys[i]), '') is not null
$$;

create function public.intake_submit(p_token text, p_answers jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  f public.intake_forms;
  a jsonb := coalesce(p_answers, '{}');
  v_height numeric;
  v_weight numeric;
  v_dob date;
  stamp text := 'From the intake form, ' || to_char(now(), 'DD Mon YYYY') || e':\n';
  v_medical text;
  v_nutrition text;
  v_lifestyle text;
begin
  select * into f from public.intake_forms where token = p_token for update;
  if f.id is null then
    raise exception 'This link is not valid.' using errcode = 'P0002';
  end if;
  if f.submitted_at is not null then
    raise exception 'This form was already sent. Thank you!' using errcode = '22023';
  end if;
  if f.expires_at < now() then
    raise exception 'This link has expired. Ask your dietitian for a new one.' using errcode = '22023';
  end if;
  if pg_column_size(a) > 20000 then
    raise exception 'The answers are too long.' using errcode = '22023';
  end if;

  -- Numbers and dates that don't parse or make no sense are ignored, not fatal.
  begin v_height := nullif(a ->> 'height_cm', '')::numeric; exception when others then v_height := null; end;
  begin v_weight := nullif(a ->> 'weight_kg', '')::numeric; exception when others then v_weight := null; end;
  begin v_dob := nullif(a ->> 'date_of_birth', '')::date; exception when others then v_dob := null; end;
  if v_height < 40 or v_height > 250 then v_height := null; end if;
  if v_weight < 20 or v_weight > 400 then v_weight := null; end if;
  if v_dob > current_date or v_dob < current_date - interval '120 years' then v_dob := null; end if;

  v_medical := public.intake_lines(a, array['conditions', 'family_history', 'anything_else'], array['Conditions', 'Family history', 'Also']);
  v_nutrition := public.intake_lines(a, array['meals_per_day', 'typical_day', 'likes', 'dislikes', 'previous_diets'],
                                     array['Meals a day', 'Typical day', 'Likes', 'Dislikes', 'Previous diets']);
  v_lifestyle := public.intake_lines(a, array['sleep', 'work', 'exercise', 'smoking'], array['Sleep', 'Work', 'Exercise', 'Smoking']);

  update public.intake_forms set submitted_at = now(), answers = a where id = f.id;

  -- Personal details only where the file has none.
  update public.patients set
    date_of_birth = coalesce(date_of_birth, v_dob),
    sex = coalesce(sex, case when a ->> 'sex' in ('female', 'male') then (a ->> 'sex')::public.sex end),
    phone = coalesce(phone, nullif(left(trim(a ->> 'phone'), 40), ''))
   where id = f.patient_id;

  -- Health: empty fields are filled; text already written by the dietitian is
  -- kept and the patient's answers are added below it, marked as theirs.
  insert into public.patient_health (patient_id) values (f.patient_id) on conflict (patient_id) do nothing;
  update public.patient_health h set
    height_cm = coalesce(h.height_cm, v_height),
    activity_level = coalesce(h.activity_level, case when a ->> 'activity_level' in ('sedentary', 'light', 'moderate', 'active', 'very_active') then (a ->> 'activity_level')::public.activity_level end),
    goal = coalesce(h.goal, nullif(left(trim(a ->> 'goal'), 500), '')),
    medical_history = left(concat_ws(e'\n\n', h.medical_history, stamp || v_medical), 5000),
    medications = left(concat_ws(e'\n\n', h.medications, stamp || nullif(trim(a ->> 'medications'), '')), 2000),
    nutrition_history = left(concat_ws(e'\n\n', h.nutrition_history, stamp || v_nutrition), 5000),
    lifestyle = left(concat_ws(e'\n\n', h.lifestyle, stamp || v_lifestyle), 2000),
    updated_at = now()
   where h.patient_id = f.patient_id;

  -- Allergies ticked on the form that the file doesn't list yet.
  insert into public.patient_allergies (patient_id, allergen, kind, severity, notes)
  select f.patient_id, x, 'allergy', 'moderate', 'From the intake form'
    from jsonb_array_elements_text(coalesce(a -> 'allergies', '[]')) x
   where x = any (public.nx_allergens())
     and not exists (select 1 from public.patient_allergies pa where pa.patient_id = f.patient_id and pa.allergen = x);
  if nullif(trim(a ->> 'other_allergies'), '') is not null then
    insert into public.patient_allergies (patient_id, allergen, label, kind, severity, notes)
    values (f.patient_id, 'other', left(trim(a ->> 'other_allergies'), 80), 'allergy', 'moderate', 'From the intake form');
  end if;

  -- Today's weight, as reported by the patient.
  if v_weight is not null then
    insert into public.measurements (patient_id, measured_on, weight_kg, source)
    values (f.patient_id, current_date, v_weight, 'patient');
  end if;
end;
$$;

revoke execute on function public.intake_create(uuid) from public, anon;
grant execute on function public.intake_create(uuid) to authenticated;
revoke execute on function public.intake_get(text), public.intake_submit(text, jsonb), public.intake_lines(jsonb, text[], text[]) from public;
grant execute on function public.intake_get(text), public.intake_submit(text, jsonb) to anon, authenticated;
