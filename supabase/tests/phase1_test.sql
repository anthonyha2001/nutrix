-- Phase 1: foods, recipes, patient file, templates and meal plans.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

-- Library sanity: USDA foods and computed Lebanese recipes.
do $$
declare
  t public.foods;
  portion numeric;
begin
  assert (select count(*) from public.foods where source = 'usda') > 7000, 'USDA library loaded';
  assert (select kcal from public.foods where source = 'usda' and source_ref = '171413') = 884, 'olive oil 884 kcal/100 g as published';
  select * into t from public.foods where name = 'Tabbouleh';
  -- Tabbouleh: 528 g batch. Energy is dominated by 40 g olive oil (354 kcal) + 40 g dry bulgur (136 kcal).
  assert t.kcal between 100 and 140, format('tabbouleh kcal/100 g plausible, got %s', t.kcal);
  assert 'gluten' = any (t.allergens), 'bulgur makes tabbouleh gluten';
  select grams into portion from public.food_servings where food_id = t.id and label = '1 portion';
  assert portion = 132, format('tabbouleh portion = 528/4, got %s', portion);
  assert (select allergens from public.foods where name = 'Hummus bi tahini') = '{sesame}', 'hummus: sesame only';
  assert (select count(*) from public.foods where category = 'Lebanese dishes') = 10, 'ten dishes';
end $$;

insert into auth.users (email, raw_user_meta_data) values
  ('olivia@test.lb', '{"full_name":"Olivia Owner"}'),
  ('dina@test.lb', '{"full_name":"Dina Dietitian"}'),
  ('rami@test.lb', '{"full_name":"Rami Dietitian"}'),
  ('asma@test.lb', '{"full_name":"Asma Assistant"}'),
  ('other@test.lb', '{"full_name":"Other Clinic Owner"}');

select pg_temp.act_as('olivia@test.lb');
select public.create_practice('Beirut Nutrition Clinic') as practice_id \gset
insert into public.invites (practice_id, email, role, invited_by)
select :'practice_id', e, r::public.practice_role, auth.uid()
from (values ('dina@test.lb', 'dietitian'), ('rami@test.lb', 'dietitian'), ('asma@test.lb', 'assistant')) v(e, r);
select pg_temp.act_as('dina@test.lb'); select public.claim_mine();
select pg_temp.act_as('rami@test.lb'); select public.claim_mine();
select pg_temp.act_as('asma@test.lb'); select public.claim_mine();
select pg_temp.act_as('other@test.lb'); select public.create_practice('Other Clinic') as other_practice \gset

-- Dina's patient Lina.
select pg_temp.act_as('dina@test.lb');
insert into public.patients (practice_id, dietitian_id, full_name, email)
values (:'practice_id', auth.uid(), 'Lina Patient', 'lina@test.lb')
returning id as lina \gset
select set_config('test.lina', :'lina', false);

-- A custom food, visible only inside the practice.
select public.save_food(:'practice_id', null, 'Clinic protein bar', 'Local brand', 'Snacks',
  400, 30, 40, 12, 5, 10, 200, '{peanut}', '[{"label":"1 bar","grams":50}]') as bar \gset
select set_config('test.bar', :'bar', false);
select pg_temp.act_as('other@test.lb');
do $$ begin
  assert (select count(*) from public.foods where name = 'Clinic protein bar') = 0, 'custom food hidden from other practices';
end $$;
-- Other clinics can't put Dina's food in their plans either.
do $$ begin
  begin
    perform public.save_template((select id from public.practices where name = 'Other Clinic'), null, 'meal', 'Steal', null, null,
      jsonb_build_object('days', jsonb_build_array(jsonb_build_object('meals', jsonb_build_array(jsonb_build_object(
        'slot', 'snack', 'items', jsonb_build_array(jsonb_build_object('food_id', current_setting('test.bar', true), 'grams', 50))))))));
    assert false, 'using another practice''s food should fail';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Assistants can't add foods.
select pg_temp.act_as('asma@test.lb');
do $$ begin
  begin
    perform public.save_food((select id from public.practices limit 1), null, 'X', null, null, 1, 1, 1, 1, null, null, null, '{}', '[]');
    assert false, 'assistant cannot add foods';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Dina builds a day template. Client-sent numbers are ignored; the database computes them.
select pg_temp.act_as('dina@test.lb');
select set_config('test.oil', (select id::text from public.foods where source = 'usda' and source_ref = '171413'), false);
select set_config('test.tab', (select id::text from public.foods where name = 'Tabbouleh'), false);
select public.save_template(:'practice_id', null, 'day', 'Mediterranean day', 'Weight loss', null, jsonb_build_object('days', jsonb_build_array(
  jsonb_build_object('label', 'Day 1', 'meals', jsonb_build_array(
    jsonb_build_object('slot', 'lunch', 'items', jsonb_build_array(
      jsonb_build_object('food_id', current_setting('test.tab'), 'grams', 200, 'kcal', 99999,
        'alternatives', jsonb_build_array(jsonb_build_object('food_id', current_setting('test.bar'), 'grams', 50))),
      jsonb_build_object('food_id', current_setting('test.oil'), 'grams', 10)
    ))
  ))
))) as tpl \gset

do $$
declare
  c jsonb := (select content from public.templates where name = 'Mediterranean day');
  item jsonb := c -> 'days' -> 0 -> 'meals' -> 0 -> 'items' -> 0;
begin
  assert (item ->> 'kcal')::numeric < 1000, 'client kcal ignored';
  assert (item ->> 'kcal')::numeric = round((select kcal from public.foods where name = 'Tabbouleh') * 2, 1), 'kcal = per100 x 2';
  assert (c -> 'days' -> 0 -> 'meals' -> 0 -> 'items' -> 1 ->> 'kcal')::numeric = 88.4, 'oil 10 g = 88.4 kcal';
  assert (item -> 'alternatives' -> 0 ->> 'kcal')::numeric = 200, 'swap snapshotted: bar 50 g = 200 kcal';
  assert (c -> 'totals' ->> 'kcal')::numeric = round((item ->> 'kcal')::numeric + 88.4), 'day total';
end $$;

-- Templates are private, even from the practice owner and colleagues.
select pg_temp.act_as('rami@test.lb');
do $$ begin assert (select count(*) from public.templates) = 0, 'colleague cannot see template'; end $$;
select pg_temp.act_as('olivia@test.lb');
do $$ begin assert (select count(*) from public.templates) = 0, 'owner cannot see dietitian''s template'; end $$;

-- Plan from template is a snapshot: editing the template or the food afterwards doesn't touch it.
select pg_temp.act_as('dina@test.lb');
select public.plan_from_template(:'lina', :'tpl') as plan1 \gset
select public.save_food(:'practice_id', :'bar', 'Clinic protein bar', 'Local brand', 'Snacks',
  500, 30, 40, 12, 5, 10, 200, '{peanut}', '[]');
select public.save_template(:'practice_id', :'tpl', 'day', 'Mediterranean day', null, null, jsonb_build_object('days', jsonb_build_array(
  jsonb_build_object('meals', jsonb_build_array(jsonb_build_object('slot', 'dinner', 'items', jsonb_build_array(
    jsonb_build_object('food_id', current_setting('test.oil'), 'grams', 5))))))));
do $$
declare p public.meal_plans := (select m from public.meal_plans m limit 1);
begin
  assert p.status = 'draft', 'new plan is a draft';
  assert p.content -> 'days' -> 0 -> 'meals' -> 0 ->> 'slot' = 'lunch', 'plan kept template content';
  assert (p.content -> 'days' -> 0 -> 'meals' -> 0 -> 'items' -> 0 -> 'alternatives' -> 0 ->> 'kcal')::numeric = 200, 'plan kept old food numbers';
  assert p.source_template_id is not null, 'remembers its template';
end $$;

-- Lina signs up: no drafts visible. Once given, she sees it.
reset role;
insert into auth.users (email, raw_user_meta_data) values ('lina@test.lb', '{"full_name":"Lina Patient"}');
select pg_temp.act_as('lina@test.lb');
do $$ begin assert (select count(*) from public.meal_plans) = 0, 'patient cannot see drafts'; end $$;
select pg_temp.act_as('dina@test.lb');
select public.activate_meal_plan(:'plan1');
select public.save_meal_plan(:'lina', null, 'Plan 2', null, null, '{"kcal":"1800","bogus":"1","fat_g":"-3"}', null,
  (select content from public.meal_plans where id = :'plan1')) as plan2 \gset
do $$ begin
  assert (select targets from public.meal_plans where name = 'Plan 2') = '{"kcal": 1800}', 'only valid targets kept';
end $$;
select public.activate_meal_plan(:'plan2');
do $$ begin
  assert (select status from public.meal_plans where name = 'Mediterranean day') = 'archived', 'previous plan archived';
  assert (select status from public.meal_plans where name = 'Plan 2') = 'active', 'new plan active';
end $$;
-- Previous plans can't be edited.
do $$ begin
  begin
    perform public.save_meal_plan((select patient_id from public.meal_plans limit 1), (select id from public.meal_plans where status = 'archived'),
      'Changed', null, null, '{}', null, (select content from public.meal_plans where status = 'archived'));
    assert false, 'archived plan is read-only';
  exception when no_data_found then null;
  end;
end $$;

-- Patient file.
insert into public.patient_health (patient_id, height_cm, goal) values (:'lina', 165, 'Lose 5 kg');
insert into public.patient_allergies (patient_id, allergen, severity) values (:'lina', 'peanut', 'severe');
insert into public.measurements (patient_id, weight_kg, body_fat_pct) values (:'lina', 72.5, 31);
insert into public.consultation_notes (patient_id, author_id, body) values (:'lina', auth.uid(), 'First visit.');

select pg_temp.act_as('lina@test.lb');
do $$ begin
  assert (select count(*) from public.meal_plans) = 2, 'patient sees active and previous plans';
  assert (select count(*) from public.measurements) = 1, 'patient sees own measurements';
  assert (select count(*) from public.patient_allergies) = 1, 'patient sees own allergies';
  assert (select count(*) from public.consultation_notes) = 0, 'notes are clinician-only';
  assert (select count(*) from public.patient_health) = 0, 'medical history is clinician-only';
end $$;

select pg_temp.act_as('asma@test.lb');
do $$ begin
  assert (select count(*) from public.patients) = 1, 'assistant sees the patient';
  assert (select count(*) from public.meal_plans) = 0, 'assistant: no plans';
  assert (select count(*) from public.measurements) = 0, 'assistant: no measurements';
  assert (select count(*) from public.consultation_notes) = 0, 'assistant: no notes';
end $$;

select pg_temp.act_as('rami@test.lb');
do $$ begin
  assert (select count(*) from public.meal_plans) = 0, 'other dietitian: no plans';
  assert (select count(*) from public.measurements) = 0, 'other dietitian: no measurements';
end $$;
do $$ begin
  begin
    insert into public.measurements (patient_id, weight_kg) values (current_setting('test.lina')::uuid, 70);
    assert false, 'other dietitian cannot write measurements';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.act_as('olivia@test.lb');
do $$ begin
  assert (select count(*) from public.meal_plans) = 2, 'owner sees all plans';
  assert (select count(*) from public.consultation_notes) = 1, 'owner sees notes';
end $$;

-- Recipes: a practice copy can be adjusted without touching the library dish.
select pg_temp.act_as('dina@test.lb');
select public.copy_recipe(:'practice_id', (select id from public.foods where name = 'Tabbouleh')) as my_tab \gset
do $$ begin
  assert (select count(*) from public.foods where name = 'Tabbouleh') = 2, 'library dish plus practice copy';
  assert (select count(*) from public.recipe_ingredients ri join public.foods f on f.id = ri.recipe_id
           where f.name = 'Tabbouleh' and f.practice_id is not null) = 8, 'ingredients copied';
end $$;

reset role;
select 'phase1_test passed' as result;
