-- Clinical tools: target weight, lab results (access) and the intake form.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce((select id::text from auth.users where email = p_email), ''), false);
  execute 'set role authenticated';
end;
$$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end;
$$;
create function pg_temp.lina() returns uuid language sql as $$ select current_setting('test.lina')::uuid $$;

insert into auth.users (email, raw_user_meta_data) values
  ('olivia@test.lb', '{"full_name":"Olivia Owner"}'),
  ('dina@test.lb', '{"full_name":"Dina Dietitian"}'),
  ('asma@test.lb', '{"full_name":"Asma Assistant"}'),
  ('other@test.lb', '{"full_name":"Other Clinic Owner"}');

select pg_temp.act_as('olivia@test.lb');
select set_config('test.practice', public.create_practice('Beirut Nutrition Clinic')::text, false);
insert into public.invites (practice_id, email, role, invited_by)
select current_setting('test.practice')::uuid, e, r::public.practice_role, auth.uid()
  from (values ('dina@test.lb', 'dietitian'), ('asma@test.lb', 'assistant')) v(e, r);
select pg_temp.act_as('dina@test.lb'); select public.claim_mine();
select pg_temp.act_as('asma@test.lb'); select public.claim_mine();
select pg_temp.act_as('other@test.lb'); select public.create_practice('Other Clinic');

select pg_temp.act_as('dina@test.lb');
do $$
declare v uuid;
begin
  insert into public.patients (practice_id, dietitian_id, full_name)
  values (current_setting('test.practice')::uuid, auth.uid(), 'Lina Haddad') returning id into v;
  perform set_config('test.lina', v::text, false);
  insert into public.patient_health (patient_id, goal, medical_history) values (v, 'Lose 6 kg', 'Hypothyroidism, treated.');
end $$;

-- Target weight is a plain health field with a sane range.
do $$ begin
  update public.patient_health set target_weight_kg = 68 where patient_id = pg_temp.lina();
  assert (select target_weight_kg from public.patient_health where patient_id = pg_temp.lina()) = 68, 'target weight saved';
  begin
    update public.patient_health set target_weight_kg = 5 where patient_id = pg_temp.lina();
    assert false, 'target weight under 20 kg rejected';
  exception when check_violation then null;
  end;
end $$;

-- Lab results: the clinical team only.
do $$ begin
  insert into public.lab_results (patient_id, measured_on, test, value, unit) values
    (pg_temp.lina(), '2026-10-01', 'hba1c', 6.1, '%'),
    (pg_temp.lina(), '2026-11-01', 'hba1c', 5.8, '%');
  assert (select count(*) from public.lab_results where patient_id = pg_temp.lina()) = 2, 'dietitian sees labs';
end $$;
select pg_temp.act_as('olivia@test.lb');
do $$ begin assert (select count(*) from public.lab_results) = 2, 'owner sees labs'; end $$;
select pg_temp.act_as('asma@test.lb');
do $$ begin
  assert (select count(*) from public.lab_results) = 0, 'assistant sees no labs';
  begin
    insert into public.lab_results (patient_id, measured_on, test, value, unit) values (pg_temp.lina(), current_date, 'ldl', 100, 'mg/dL');
    assert false, 'assistant cannot add labs';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.act_as('other@test.lb');
do $$ begin assert (select count(*) from public.lab_results) = 0, 'other practice sees no labs'; end $$;

-- Intake form: only the clinical team creates links; the link reveals nothing but a first name.
select pg_temp.act_as('asma@test.lb');
do $$ begin
  begin
    perform public.intake_create(pg_temp.lina());
    assert false, 'assistant cannot send intake forms';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.act_as('dina@test.lb');
select set_config('test.token', public.intake_create(pg_temp.lina()), false);
do $$ begin
  assert char_length(current_setting('test.token')) = 64, 'long random token';
  assert public.intake_create(pg_temp.lina()) = current_setting('test.token'), 'the open link is reused';
end $$;

select pg_temp.as_anon();
do $$
declare r record;
begin
  select * into r from public.intake_get(current_setting('test.token'));
  assert r.first_name = 'Lina' and r.practice_name = 'Beirut Nutrition Clinic' and r.status = 'open', format('form shows first name and practice, got %s', r);
  assert not exists (select 1 from public.intake_get('not-a-token')), 'unknown token shows nothing';
  begin
    perform 1 from public.intake_forms;
    assert false, 'anon cannot read intake forms';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.patients;
    assert false, 'anon cannot read patients';
  exception when insufficient_privilege then null;
  end;

  perform public.intake_submit(current_setting('test.token'), '{
    "date_of_birth": "1990-05-04", "sex": "female", "phone": "71 123 456",
    "height_cm": "165", "weight_kg": "74.5", "activity_level": "light", "goal": "Feel lighter",
    "conditions": "PCOS", "medications": "Levothyroxine 50 mcg",
    "allergies": ["sesame", "not_real"], "other_allergies": "Kiwi",
    "meals_per_day": "2", "typical_day": "Coffee, late lunch, big dinner", "dislikes": "Fish",
    "sleep": "6 hours", "exercise": "None"
  }');
  select status into r from public.intake_get(current_setting('test.token'));
  assert r.status = 'submitted', 'form marked submitted';
  begin
    perform public.intake_submit(current_setting('test.token'), '{}');
    assert false, 'a form can be sent once';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- The file is filled where empty, and the dietitian's text is kept.
reset role;
do $$
declare h public.patient_health; p public.patients;
begin
  select * into h from public.patient_health where patient_id = pg_temp.lina();
  select * into p from public.patients where id = pg_temp.lina();
  assert p.date_of_birth = '1990-05-04' and p.sex = 'female' and p.phone = '71 123 456', 'personal details filled';
  assert h.height_cm = 165 and h.activity_level = 'light', 'height and activity filled';
  assert h.goal = 'Lose 6 kg', 'existing goal kept';
  assert h.medical_history like 'Hypothyroidism, treated.%From the intake form%Conditions: PCOS', format('history appended, got %s', h.medical_history);
  assert h.medications like 'From the intake form%Levothyroxine 50 mcg', 'medications filled';
  assert h.nutrition_history like '%Meals a day: 2%Typical day: Coffee, late lunch, big dinner%Dislikes: Fish', 'nutrition answers labelled';
  assert h.lifestyle like '%Sleep: 6 hours%Exercise: None', 'lifestyle answers labelled';
  assert (select array_agg(allergen order by allergen) from public.patient_allergies where patient_id = pg_temp.lina()) = '{other,sesame}', 'known and other allergies added, unknown ignored';
  assert (select weight_kg from public.measurements where patient_id = pg_temp.lina() and source = 'patient') = 74.5, 'reported weight recorded';
end $$;

-- Expired links can't be used.
do $$
declare t text;
begin
  insert into public.intake_forms (patient_id, expires_at) values (pg_temp.lina(), now() - interval '1 day') returning token into t;
  assert (select status from public.intake_get(t)) = 'expired', 'expired link reported';
  begin
    perform public.intake_submit(t, '{}');
    assert false, 'expired link rejected';
  exception when invalid_parameter_value then null;
  end;
end $$;

select 'clinical_tools_test passed' as result;
