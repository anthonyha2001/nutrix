-- A large shared food library built from open datasets.
--
-- Migrations no longer carry the food rows. The bulk data (millions of rows) is
-- loaded by `foods-import/` (see its README), which downloads each dataset,
-- normalizes it to per-100 g values and upserts it by (dataset, source_ref).
-- This migration adds what that needs: a register of datasets and their
-- licences, barcodes, a branded/generic split, accent-free search text, and a
-- search function that stays fast with millions of rows.

create extension if not exists unaccent with schema extensions;

alter type public.food_source add value if not exists 'openfoodfacts';
alter type public.food_source add value if not exists 'cnf';

-- Every imported dataset, with the licence and attribution it requires.
create table public.food_datasets (
  id           text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name         text not null,
  publisher    text not null,
  version      text,
  licence      text not null,
  licence_url  text,
  url          text,
  -- Shown wherever the data is shown, as the licence requires.
  attribution  text not null,
  -- True when the licence carries obligations beyond attribution (for example
  -- ODbL share-alike), so these rows can be kept apart or removed in one go.
  share_alike  boolean not null default false,
  food_count   integer not null default 0,
  imported_at  timestamptz
);

alter table public.food_datasets enable row level security;
revoke all on public.food_datasets from public, anon;
grant select on public.food_datasets to authenticated;
create policy food_datasets_select on public.food_datasets for select to authenticated using (true);

insert into public.food_datasets (id, name, publisher, version, licence, licence_url, url, attribution, share_alike) values
  ('usda_sr_legacy', 'FoodData Central SR Legacy', 'USDA Agricultural Research Service', '2018-04',
   'CC0 1.0 (public domain)', 'https://creativecommons.org/publicdomain/zero/1.0/', 'https://fdc.nal.usda.gov',
   'USDA FoodData Central', false),
  ('usda_foundation', 'FoodData Central Foundation Foods', 'USDA Agricultural Research Service', null,
   'CC0 1.0 (public domain)', 'https://creativecommons.org/publicdomain/zero/1.0/', 'https://fdc.nal.usda.gov',
   'USDA FoodData Central', false),
  ('usda_survey', 'FoodData Central FNDDS (Survey)', 'USDA Agricultural Research Service', null,
   'CC0 1.0 (public domain)', 'https://creativecommons.org/publicdomain/zero/1.0/', 'https://fdc.nal.usda.gov',
   'USDA FoodData Central', false),
  ('usda_branded', 'FoodData Central Branded Foods', 'USDA Agricultural Research Service', null,
   'CC0 1.0 (public domain)', 'https://creativecommons.org/publicdomain/zero/1.0/', 'https://fdc.nal.usda.gov',
   'USDA FoodData Central (label data supplied by manufacturers)', false),
  ('cnf', 'Canadian Nutrient File', 'Health Canada', '2015',
   'Open Government Licence - Canada', 'https://open.canada.ca/en/open-government-licence-canada',
   'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data.html',
   'Contains information licensed under the Open Government Licence - Canada (Canadian Nutrient File, Health Canada, 2015)', false),
  ('openfoodfacts', 'Open Food Facts', 'Open Food Facts contributors', null,
   'ODbL 1.0 (database), DbCL 1.0 (contents)', 'https://opendatacommons.org/licenses/odbl/1-0/',
   'https://world.openfoodfacts.org', 'Open Food Facts, openfoodfacts.org (ODbL)', true),
  ('nutrix', 'Nutrix standard recipes', 'Nutrix', null,
   'Nutrix', null, null, 'Nutrix', false);

alter table public.foods
  add column dataset     text references public.food_datasets (id),
  -- GTIN/EAN/UPC as printed, digits only.
  add column barcode     text check (barcode ~ '^[0-9]{6,14}$'),
  -- Packaged products from a manufacturer, as opposed to generic foods.
  add column branded     boolean not null default false,
  -- Lowercase, accent-free name, brand and aliases. Maintained by a trigger.
  add column search_text text not null default '',
  -- Looked up online and saved because someone used it. Bulk imports never archive these.
  add column saved_on_use boolean not null default false;

update public.foods set dataset = 'usda_sr_legacy' where source = 'usda';
update public.foods set dataset = 'nutrix' where source = 'nutrix';

create function public.food_search_text(p_name text, p_brand text, p_aliases text[])
returns text language sql stable set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent',
           concat_ws(' ', nullif(trim(p_name), ''), nullif(trim(p_brand), ''), nullif(array_to_string(p_aliases, ' '), ''))))
$$;

create function public.foods_set_search_text()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.search_text := public.food_search_text(new.name, new.brand, new.aliases);
  return new;
end;
$$;

create trigger foods_search_text
  before insert or update of name, brand, aliases on public.foods
  for each row execute function public.foods_set_search_text();

update public.foods set search_text = public.food_search_text(name, brand, aliases);

-- Search indexes. Generic foods (tens of thousands) get their own index so they
-- are searched in full; branded products (millions) are searched second.
drop index if exists public.foods_name_trgm;
create index foods_search_generic on public.foods using gin (search_text extensions.gin_trgm_ops)
  where archived_at is null and not branded;
create index foods_search_branded on public.foods using gin (search_text extensions.gin_trgm_ops)
  where archived_at is null and branded;
create index foods_barcode_idx on public.foods (ltrim(barcode, '0')) where barcode is not null;
create index foods_dataset_idx on public.foods (dataset);
-- Imports upsert on this. Nutrix recipes share one source_ref, so they're excluded.
create unique index foods_dataset_ref_unique on public.foods (dataset, source_ref)
  where dataset is not null and dataset <> 'nutrix' and source_ref is not null;

-- Ranked food search for the meal plan builder, diary, recipe editor and library.
-- Every word typed must appear in the name, brand or an alias (accents ignored).
-- A barcode (8 to 14 digits) finds that product. Order: the practice's own
-- foods, Lebanese dishes, then generic foods by closeness, then branded products.
-- Runs as the caller, so row-level security decides what can be found.
create or replace function public.search_foods(p_query text, p_category text default null, p_limit integer default 30)
returns setof public.foods
language plpgsql stable set search_path = ''
as $$
declare
  v_text     text := lower(extensions.unaccent('extensions.unaccent', trim(coalesce(p_query, ''))));
  v_limit    integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_words    text[];
  v_patterns text[] := '{}';
  v_longest  text;
  v_where    text := '';
  v_found    integer := 0;
  w          text;
  i          integer := 0;
begin
  v_words := array_remove(regexp_split_to_array(v_text, '[\s,]+'), '');

  if cardinality(v_words) = 0 then
    return query
      select f.* from public.foods f
       where f.archived_at is null and not f.branded
         and (p_category is null or f.category = p_category)
       order by (f.practice_id is not null) desc, (f.category = 'Lebanese dishes') desc, f.name
       limit v_limit;
    return;
  end if;

  if v_text ~ '^[0-9]{8,14}$' then
    return query
      select f.* from public.foods f
       where f.archived_at is null and f.barcode is not null
         and ltrim(f.barcode, '0') = ltrim(v_text, '0')
       order by (f.practice_id is not null) desc, f.dataset
       limit v_limit;
    return;
  end if;

  -- One LIKE per word, written out so each plan sees the patterns and can use
  -- the trigram indexes (the longest word drives the index).
  foreach w in array v_words loop
    i := i + 1;
    v_patterns := v_patterns || ('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%');
    v_where := v_where || format(' and f.search_text like $1[%s]', i);
    if v_longest is null or char_length(w) > char_length(v_longest) then
      v_longest := w;
    end if;
  end loop;

  return query execute format($q$
    select f.* from public.foods f
     where f.archived_at is null and not f.branded
       and ($3 is null or f.category = $3) %s
     order by (f.practice_id is not null) desc,
              (f.category = 'Lebanese dishes') desc,
              (lower(f.name) = $2 or $2 = any (select lower(a) from unnest(f.aliases) a)) desc,
              (f.search_text like $2 || '%%') desc,
              extensions.word_similarity($2, f.search_text) desc,
              char_length(f.name)
     limit $4
  $q$, v_where) using v_patterns, v_text, p_category, v_limit;
  get diagnostics v_found = row_count;

  -- Branded products fill the rest. Short words can't use the trigram index, so
  -- branded search needs at least one word of three letters or more. Candidates
  -- are capped before ranking to keep common words ("milk") fast.
  if v_found < v_limit and char_length(v_longest) >= 3 then
    return query execute format($q$
      select c.* from (
        select f.* from public.foods f
         where f.archived_at is null and f.branded
           and ($3 is null or f.category = $3) %s
         limit 3000
      ) c
      order by (c.search_text = $2 or c.search_text like $2 || ' %%') desc,
               (c.search_text like $2 || '%%') desc,
               extensions.word_similarity($2, c.search_text) desc,
               char_length(c.name)
      limit $4
    $q$, v_where) using v_patterns, v_text, p_category, v_limit - v_found;
  end if;
end;
$$;

revoke execute on function public.search_foods(text, text, integer) from public, anon;
grant execute on function public.search_foods(text, text, integer) to authenticated;

-- Bulk import staging. Only the importer (service role / postgres) uses it.
create table public.food_import_stage (
  dataset    text not null,
  source_ref text not null,
  name       text not null,
  brand      text,
  category   text not null,
  barcode    text,
  branded    boolean not null,
  kcal       numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  fiber_g    numeric, sugar_g numeric, sodium_mg numeric,
  allergens  text[] not null default '{}',
  -- [{"label": "1 cup", "grams": 240}, ...]
  servings   jsonb not null default '[]'
);
create index food_import_stage_ref on public.food_import_stage (dataset, source_ref);
alter table public.food_import_stage enable row level security;
revoke all on public.food_import_stage from public, anon, authenticated;

-- Moves one dataset from the stage into foods: upserts by (dataset, source_ref),
-- replaces servings, and archives rows the dataset no longer contains (never
-- deletes them, because plans, diaries and recipes may point at them).
create function public.food_import_apply(p_dataset text, p_version text)
returns integer language plpgsql set search_path = ''
as $$
declare
  v_source public.food_source;
  v_count  integer;
begin
  v_source := case when p_dataset like 'usda%' then 'usda'
                   when p_dataset = 'openfoodfacts' then 'openfoodfacts'
                   when p_dataset = 'cnf' then 'cnf'
              end::public.food_source;
  if v_source is null then
    raise exception 'unknown dataset %', p_dataset;
  end if;

  drop table if exists pg_temp.import_ids;
  create temp table import_ids (food_id uuid, servings jsonb) on commit drop;

  with up as (
    insert into public.foods as f (name, brand, category, source, source_ref, dataset, barcode, branded,
                                   kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, allergens)
    select s.name, s.brand, s.category, v_source, s.source_ref, s.dataset, s.barcode, s.branded,
           s.kcal, s.protein_g, s.carbs_g, s.fat_g, s.fiber_g, s.sugar_g, s.sodium_mg, s.allergens
      from public.food_import_stage s
     where s.dataset = p_dataset
    on conflict (dataset, source_ref) where dataset is not null and dataset <> 'nutrix' and source_ref is not null
    do update set name = excluded.name, brand = excluded.brand, category = excluded.category,
                  barcode = excluded.barcode, branded = excluded.branded,
                  kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
                  fat_g = excluded.fat_g, fiber_g = excluded.fiber_g, sugar_g = excluded.sugar_g,
                  sodium_mg = excluded.sodium_mg, allergens = excluded.allergens,
                  archived_at = null, updated_at = now()
    returning f.id, f.source_ref
  )
  insert into pg_temp.import_ids
  select up.id, s.servings from up
    join public.food_import_stage s on s.dataset = p_dataset and s.source_ref = up.source_ref;

  delete from public.food_servings fs using pg_temp.import_ids i where fs.food_id = i.food_id;
  insert into public.food_servings (food_id, label, grams, sort)
  select i.food_id, left(e.value ->> 'label', 120), (e.value ->> 'grams')::numeric, e.ordinality
    from pg_temp.import_ids i, jsonb_array_elements(i.servings) with ordinality e
   where (e.value ->> 'grams')::numeric > 0 and (e.value ->> 'grams')::numeric <= 5000
     and char_length(trim(e.value ->> 'label')) between 1 and 120;

  update public.foods f set archived_at = now()
   where f.dataset = p_dataset and f.archived_at is null and not f.saved_on_use
     and not exists (select 1 from public.food_import_stage s where s.dataset = p_dataset and s.source_ref = f.source_ref);

  select count(*) into v_count from public.foods where dataset = p_dataset and archived_at is null;
  update public.food_datasets set food_count = v_count, version = coalesce(p_version, version), imported_at = now()
   where id = p_dataset;
  delete from public.food_import_stage where dataset = p_dataset;
  return v_count;
end;
$$;

revoke execute on function public.food_import_apply(text, text) from public, anon, authenticated;

-- Saves one product that the web server looked up on Open Food Facts because a
-- dietitian or patient picked it. Only the server calls this (service key),
-- with values it fetched itself, so the shared library never takes nutrition
-- values from a browser. An existing row is returned as is (loaded data wins).
create function public.food_save_online(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id  uuid;
  v_ref text := p ->> 'source_ref';
begin
  if v_ref is null or v_ref !~ '^[0-9]{6,14}$' then
    raise exception 'Invalid product code.' using errcode = '22023';
  end if;

  select id into v_id from public.foods
   where dataset = 'openfoodfacts' and source_ref = v_ref;
  if v_id is not null then
    update public.foods set archived_at = null, saved_on_use = true where id = v_id and archived_at is not null;
    return v_id;
  end if;

  insert into public.foods (name, brand, category, source, source_ref, dataset, barcode, branded, saved_on_use,
                            kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, allergens)
  values (left(trim(p ->> 'name'), 200), left(nullif(trim(p ->> 'brand'), ''), 120), coalesce(nullif(p ->> 'category', ''), 'Other'),
          'openfoodfacts', v_ref, 'openfoodfacts', v_ref, true, true,
          (p ->> 'kcal')::numeric, (p ->> 'protein_g')::numeric, (p ->> 'carbs_g')::numeric, (p ->> 'fat_g')::numeric,
          (p ->> 'fiber_g')::numeric, (p ->> 'sugar_g')::numeric, (p ->> 'sodium_mg')::numeric,
          array(select a from jsonb_array_elements_text(coalesce(p -> 'allergens', '[]')) a where a = any (public.nx_allergens())))
  returning id into v_id;

  insert into public.food_servings (food_id, label, grams, sort)
  select v_id, left(trim(e.value ->> 'label'), 120), (e.value ->> 'grams')::numeric, e.ordinality
    from jsonb_array_elements(coalesce(p -> 'servings', '[]')) with ordinality e
   where (e.value ->> 'grams')::numeric > 0 and (e.value ->> 'grams')::numeric <= 5000
     and char_length(trim(e.value ->> 'label')) between 1 and 120;

  update public.food_datasets set food_count = food_count + 1 where id = 'openfoodfacts';
  return v_id;
end;
$$;

revoke execute on function public.food_save_online(jsonb) from public, anon, authenticated;
grant execute on function public.food_save_online(jsonb) to service_role;

update public.food_datasets d set food_count = (select count(*) from public.foods f where f.dataset = d.id and f.archived_at is null);
