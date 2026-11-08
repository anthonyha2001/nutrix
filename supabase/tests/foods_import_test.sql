-- Large food library: dataset import (stage -> foods), re-import, and search.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

-- Existing library is registered under its datasets and searchable.
do $$ begin
  assert (select food_count from public.food_datasets where id = 'usda_sr_legacy') > 7000, 'SR Legacy counted';
  assert not exists (select 1 from public.foods where source = 'usda' and dataset is distinct from 'usda_sr_legacy'), 'USDA rows tagged';
  assert (select search_text from public.foods where source = 'usda' and source_ref = '171413') like '%olive%', 'search text backfilled';
end $$;

-- First import: two branded products and one generic food.
insert into public.food_import_stage (dataset, source_ref, name, brand, category, barcode, branded,
  kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, allergens, servings) values
  ('openfoodfacts', '5281234567890', 'Labneh Crème', 'Taanayel', 'Dairy & eggs', '5281234567890', true,
   160, 6, 4, 14, null, 4, 400, '{dairy}', '[{"label":"1 serving (30 g)","grams":30}]'),
  ('openfoodfacts', '0001234500001', 'Zaatar mix', 'Al Rifai', 'Spices & herbs', '0001234500001', true,
   420, 12, 40, 20, 15, 1, 900, '{sesame}', '[]'),
  ('cnf', '9001', 'Labneh, plain', null, 'Dairy & eggs', null, false,
   150, 7, 5, 11, 0, 4, 300, '{dairy}', '[{"label":"1 tbsp","grams":15},{"label":"bad","grams":0}]');

do $$
declare n integer;
begin
  n := public.food_import_apply('openfoodfacts', '2026-11-08');
  assert n = 2, format('2 OFF foods, got %s', n);
  n := public.food_import_apply('cnf', '2015');
  assert n = 1, 'one CNF food';
  assert (select food_count from public.food_datasets where id = 'openfoodfacts') = 2, 'dataset count kept';
  assert (select version from public.food_datasets where id = 'openfoodfacts') = '2026-11-08', 'version recorded';
  assert (select count(*) from public.food_import_stage) = 0, 'stage emptied';
  assert (select source from public.foods where dataset = 'cnf') = 'cnf', 'source set from dataset';
  assert (select count(*) from public.food_servings s join public.foods f on f.id = s.food_id where f.dataset = 'cnf') = 1,
    'invalid serving dropped';
  assert (select search_text from public.foods where source_ref = '5281234567890') = 'labneh creme taanayel', 'accent-free search text with brand';
end $$;

-- Search as a signed-in user with no practice: library only.
insert into auth.users (email, raw_user_meta_data) values ('dina@test.lb', '{"full_name":"Dina"}');
select pg_temp.act_as('dina@test.lb');
do $$
declare names text[];
begin
  select array_agg(name) into names from public.search_foods('labneh');
  assert names[1] = 'Labneh, plain', format('generic first, got %s', names);
  assert names[2] = 'Labneh Crème', 'then the branded product';
  assert (select count(*) from public.search_foods('creme labneh')) = 1, 'words in any order, accents ignored';
  assert (select count(*) from public.search_foods('taanayel')) = 1, 'brand is searchable';
  assert (select name from public.search_foods('5281234567890')) = 'Labneh Crème', 'barcode lookup';
  assert (select name from public.search_foods('1234500001')) = 'Zaatar mix', 'barcode without leading zeros';
  assert (select count(*) from public.search_foods('olive oil', null, 5)) between 1 and 5, 'limit respected';
  assert (select count(*) from public.search_foods('zaat%r')) = 0, 'LIKE wildcards are literal';
  assert exists (select 1 from public.search_foods('zaatar') where name = 'Zaatar mix'), 'the same product is found by its name';
  assert (select name from public.search_foods('zaatar') limit 1) = 'Manoushe za''atar', 'Lebanese dish (alias zaatar) before the product';
  assert (select count(*) from public.search_foods('')) > 0, 'empty query lists the library';
  assert not exists (select 1 from public.search_foods('') where branded), 'empty query shows no branded products';
end $$;
reset role;

-- Re-import: one product changed, one dropped. Ids are kept; the dropped one is archived.
create temp table before_ids as select id, source_ref from public.foods where dataset = 'openfoodfacts';
insert into public.food_import_stage (dataset, source_ref, name, brand, category, barcode, branded,
  kcal, protein_g, carbs_g, fat_g, allergens, servings) values
  ('openfoodfacts', '5281234567890', 'Labneh Crème Light', 'Taanayel', 'Dairy & eggs', '5281234567890', true,
   110, 7, 4, 7, '{dairy}', '[]');
do $$
declare n integer;
begin
  n := public.food_import_apply('openfoodfacts', '2026-11-09');
  assert n = 1, 'one active OFF food';
  assert (select f.id from public.foods f where f.source_ref = '5281234567890')
       = (select id from before_ids where source_ref = '5281234567890'), 'same row updated';
  assert (select name from public.foods where source_ref = '5281234567890') = 'Labneh Crème Light', 'name updated';
  assert (select search_text from public.foods where source_ref = '5281234567890') like '%light%', 'search text follows the name';
  assert (select count(*) from public.food_servings s join public.foods f on f.id = s.food_id
           where f.source_ref = '5281234567890') = 0, 'servings replaced';
  assert (select archived_at from public.foods where source_ref = '0001234500001') is not null, 'dropped product archived, not deleted';
  assert (select count(*) from public.search_foods('zaatar mix')) = 0, 'archived products are not found';
end $$;

-- Only the importer can stage or apply.
select pg_temp.act_as('dina@test.lb');
do $$ begin
  begin
    perform public.food_import_apply('openfoodfacts', null);
    assert false, 'authenticated must not apply imports';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.food_import_stage (dataset, source_ref, name, category, branded) values ('cnf', 'x', 'x', 'Other', false);
    assert false, 'authenticated must not stage rows';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Products looked up online are saved by the server (service role) only, once.
select pg_temp.act_as('dina@test.lb');
do $$ begin
  begin
    perform public.food_save_online('{"source_ref":"6221234567890","name":"Fake","kcal":1,"protein_g":0,"carbs_g":0,"fat_g":0}');
    assert false, 'authenticated must not save online foods';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
create temp table saved as select public.food_save_online('{
  "source_ref":"6221234567890","name":"Halawa with pistachio","brand":"Al Rabih","category":"Sweets",
  "kcal":540,"protein_g":12,"carbs_g":50,"fat_g":33,"fiber_g":null,"sugar_g":45,"sodium_mg":40,
  "allergens":["sesame","tree_nut","not_an_allergen"],
  "servings":[{"label":"1 serving (30 g)","grams":30},{"label":"bad","grams":-1}]}'::jsonb) as id;
create temp table saved_again as
  select public.food_save_online('{"source_ref":"6221234567890","name":"Changed","kcal":1,"protein_g":0,"carbs_g":0,"fat_g":0}') as id;
do $$ begin
  begin
    perform public.food_save_online('{"source_ref":"abc","name":"x","kcal":1,"protein_g":0,"carbs_g":0,"fat_g":0}');
    assert false, 'non-numeric code rejected';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$
declare first uuid := (select id from saved);
begin
  assert (select id from saved_again) = first, 'saving again returns the same row';
  assert (select name from public.foods where id = first) = 'Halawa with pistachio', 'existing values kept';
  assert (select allergens from public.foods where id = first) = '{sesame,tree_nut}', 'unknown allergen tags dropped';
  assert (select count(*) from public.food_servings where food_id = first) = 1, 'invalid serving dropped';
  assert (select saved_on_use and branded and source = 'openfoodfacts' from public.foods where id = first), 'flags set';
end $$;

-- A later bulk import that doesn't contain the saved product leaves it active.
do $$ begin
  perform public.food_import_apply('openfoodfacts', '2026-11-10');
  assert (select archived_at from public.foods where source_ref = '6221234567890') is null, 'saved product survives re-import';
  assert (select archived_at from public.foods where source_ref = '5281234567890') is not null, 'other OFF rows still archived when dropped';
end $$;

select 'foods_import_test passed' as result;
