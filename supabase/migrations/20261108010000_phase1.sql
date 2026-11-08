-- Phase 1: food library and recipes, patient files, meal plans, private templates.
--
-- Nutrition numbers are never typed into plans. Every plan or template item
-- stores a food id and grams; the database looks the food up and writes the
-- nutrients into the item when it is saved (public.nx_snapshot). The saved
-- plan is then a snapshot: later edits to a food, a recipe or a template never
-- change it.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Foods
-- ---------------------------------------------------------------------------

create type public.food_source as enum ('usda', 'nutrix', 'practice');

-- Allergen tags shared by foods and patient allergies.
create function public.nx_allergens()
returns text[] language sql immutable as $$
  select array['gluten', 'dairy', 'egg', 'peanut', 'tree_nut', 'sesame', 'soy', 'fish', 'shellfish']
$$;

create table public.foods (
  id              uuid primary key default gen_random_uuid(),
  -- null: the shared Nutrix library (USDA and Nutrix recipes); otherwise a practice's own food.
  practice_id     uuid references public.practices (id) on delete cascade,
  created_by      uuid references public.profiles (id) on delete set null,
  name            text not null check (char_length(trim(name)) between 1 and 200),
  brand           text check (char_length(brand) <= 120),
  category        text not null default 'Other' check (char_length(category) <= 80),
  -- Other names people search by ("tabouli", "hummus bi tahini").
  aliases         text[] not null default '{}',
  source          public.food_source not null,
  -- Where the numbers come from: USDA FDC id, label, recipe.
  source_ref      text,
  is_recipe       boolean not null default false,
  -- Per 100 g. For recipes these are computed from the ingredients.
  kcal            numeric(7, 2) not null default 0 check (kcal >= 0 and kcal <= 950),
  protein_g       numeric(6, 2) not null default 0 check (protein_g between 0 and 100),
  carbs_g         numeric(6, 2) not null default 0 check (carbs_g between 0 and 100),
  fat_g           numeric(6, 2) not null default 0 check (fat_g between 0 and 100),
  fiber_g         numeric(6, 2) check (fiber_g between 0 and 100),
  sugar_g         numeric(6, 2) check (sugar_g between 0 and 100),
  sodium_mg       numeric(8, 2) check (sodium_mg between 0 and 100000),
  allergens       text[] not null default '{}' check (allergens <@ public.nx_allergens()),
  -- Recipes: cooked weight of the whole recipe (null = sum of ingredients) and portions it makes.
  recipe_yield_g  numeric(8, 1) check (recipe_yield_g > 0),
  recipe_servings integer check (recipe_servings between 1 and 100),
  instructions    text check (char_length(instructions) <= 5000),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index foods_practice_idx on public.foods (practice_id) where archived_at is null;
create index foods_name_trgm on public.foods using gin (lower(name) extensions.gin_trgm_ops);
create unique index foods_usda_unique on public.foods (source_ref) where source = 'usda';

-- Named portions: "1 cup, chopped" = 160 g.
create table public.food_servings (
  id       uuid primary key default gen_random_uuid(),
  food_id  uuid not null references public.foods (id) on delete cascade,
  label    text not null check (char_length(trim(label)) between 1 and 120),
  grams    numeric(8, 2) not null check (grams > 0 and grams <= 5000),
  sort     integer not null default 0
);

create index food_servings_food_idx on public.food_servings (food_id);

create table public.recipe_ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.foods (id) on delete cascade,
  food_id    uuid not null references public.foods (id) on delete restrict,
  grams      numeric(8, 2) not null check (grams > 0 and grams <= 20000),
  note       text check (char_length(note) <= 120),
  sort       integer not null default 0,
  check (recipe_id <> food_id)
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------------------
-- Patient file (clinical: owner and the assigned dietitian only)
-- ---------------------------------------------------------------------------

create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.measurement_source as enum ('manual', 'inbody', 'tanita', 'withings', 'apple_health', 'patient');

create table public.patient_health (
  patient_id         uuid primary key references public.patients (id) on delete cascade,
  height_cm          numeric(5, 1) check (height_cm between 40 and 250),
  activity_level     public.activity_level,
  goal               text check (char_length(goal) <= 500),
  medical_history    text check (char_length(medical_history) <= 5000),
  medications        text check (char_length(medications) <= 2000),
  nutrition_history  text check (char_length(nutrition_history) <= 5000),
  lifestyle          text check (char_length(lifestyle) <= 2000),
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

create table public.patient_allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  -- One of nx_allergens(), or 'other' with a label.
  allergen    text not null check (allergen = 'other' or allergen = any (public.nx_allergens())),
  label       text check (char_length(label) <= 80),
  kind        text not null default 'allergy' check (kind in ('allergy', 'intolerance')),
  severity    text not null default 'moderate' check (severity in ('mild', 'moderate', 'severe')),
  notes       text check (char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  check (allergen <> 'other' or char_length(trim(coalesce(label, ''))) > 0)
);

create index patient_allergies_patient_idx on public.patient_allergies (patient_id);

-- One measuring session; every metric is optional. Device imports (Phase 3)
-- set source + external_id so the same reading is never imported twice.
create table public.measurements (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  measured_on     date not null default current_date,
  weight_kg       numeric(5, 1) check (weight_kg between 1 and 400),
  body_fat_pct    numeric(4, 1) check (body_fat_pct between 1 and 80),
  muscle_mass_kg  numeric(5, 1) check (muscle_mass_kg between 1 and 200),
  body_water_pct  numeric(4, 1) check (body_water_pct between 10 and 90),
  visceral_fat    numeric(4, 1) check (visceral_fat between 0 and 60),
  bmr_kcal        integer check (bmr_kcal between 300 and 6000),
  waist_cm        numeric(5, 1) check (waist_cm between 20 and 300),
  hip_cm          numeric(5, 1) check (hip_cm between 20 and 300),
  source          public.measurement_source not null default 'manual',
  external_id     text,
  notes           text check (char_length(notes) <= 500),
  recorded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (coalesce(weight_kg, body_fat_pct, muscle_mass_kg, body_water_pct, visceral_fat, bmr_kcal, waist_cm, hip_cm) is not null)
);

create index measurements_patient_idx on public.measurements (patient_id, measured_on desc);
create unique index measurements_external_unique on public.measurements (patient_id, source, external_id) where external_id is not null;

create table public.consultation_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  noted_on    date not null default current_date,
  title       text check (char_length(title) <= 120),
  body        text not null check (char_length(trim(body)) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index consultation_notes_patient_idx on public.consultation_notes (patient_id, noted_on desc);

-- ---------------------------------------------------------------------------
-- Templates and meal plans
-- ---------------------------------------------------------------------------
-- content: { "days": [ { "label", "meals": [ { "key", "slot", "name", "time",
--   "notes", "items": [ { "food_id", "name", "grams", "serving", nutrients,
--   "allergens", "alternatives": [ items ] } ], "totals" } ], "totals" } ],
--   "totals" }   (top-level totals = average day)

create type public.template_kind as enum ('meal', 'day', 'week', 'program');
create type public.plan_status as enum ('draft', 'active', 'archived');

-- Private to the dietitian who made it, even within a practice.
create table public.templates (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  kind         public.template_kind not null,
  name         text not null check (char_length(trim(name)) between 1 and 120),
  category     text check (char_length(category) <= 60),
  description  text check (char_length(description) <= 1000),
  tags         text[] not null default '{}',
  is_favorite  boolean not null default false,
  content      jsonb not null default '{"days": []}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index templates_owner_idx on public.templates (owner_id, updated_at desc);

create table public.meal_plans (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.patients (id) on delete cascade,
  name                text not null check (char_length(trim(name)) between 1 and 120),
  status              public.plan_status not null default 'draft',
  starts_on           date,
  ends_on             date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- Daily targets set by the dietitian: { kcal, protein_g, carbs_g, fat_g }.
  targets             jsonb not null default '{}',
  notes               text check (char_length(notes) <= 3000),
  content             jsonb not null default '{"days": []}',
  -- Where it was copied from (reference only; the template can change or go away).
  source_template_id  uuid references public.templates (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null,
  activated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index meal_plans_patient_idx on public.meal_plans (patient_id, created_at desc);
create unique index meal_plans_one_active on public.meal_plans (patient_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Caller works with clinical data in this practice (owner or dietitian).
create function public.is_clinician(p_practice_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_practice_role(p_practice_id) in ('owner', 'dietitian'), false)
$$;

-- Caller may use this food (shared library, or their practice's own).
create function public.can_use_food(p_food_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.foods f
     where f.id = p_food_id and (f.practice_id is null or public.is_practice_staff(f.practice_id))
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.foods              enable row level security;
alter table public.food_servings      enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.patient_health     enable row level security;
alter table public.patient_allergies  enable row level security;
alter table public.measurements       enable row level security;
alter table public.consultation_notes enable row level security;
alter table public.templates          enable row level security;
alter table public.meal_plans         enable row level security;

revoke all on public.foods, public.food_servings, public.recipe_ingredients, public.patient_health,
  public.patient_allergies, public.measurements, public.consultation_notes, public.templates, public.meal_plans
  from anon;

-- Foods change only through save_food / save_recipe (so recipe numbers are always computed).
revoke insert, update, delete on public.foods, public.food_servings, public.recipe_ingredients from authenticated;
grant update (archived_at) on public.foods to authenticated;

create policy foods_select on public.foods for select
  using (practice_id is null or public.is_practice_staff(practice_id));
create policy foods_archive on public.foods for update
  using (practice_id is not null and public.is_clinician(practice_id))
  with check (practice_id is not null and public.is_clinician(practice_id));
create policy food_servings_select on public.food_servings for select
  using (public.can_use_food(food_id));
create policy recipe_ingredients_select on public.recipe_ingredients for select
  using (public.can_use_food(recipe_id));

-- Clinical tables: owner + assigned dietitian; the patient reads some of their own.
create policy patient_health_all on public.patient_health for all
  using (public.can_see_clinical(patient_id)) with check (public.can_see_clinical(patient_id));
create policy patient_allergies_all on public.patient_allergies for all
  using (public.can_see_clinical(patient_id)) with check (public.can_see_clinical(patient_id));
create policy patient_allergies_self on public.patient_allergies for select
  using (public.is_patient_self(patient_id));
create policy measurements_all on public.measurements for all
  using (public.can_see_clinical(patient_id)) with check (public.can_see_clinical(patient_id));
create policy measurements_self on public.measurements for select
  using (public.is_patient_self(patient_id));
create policy consultation_notes_all on public.consultation_notes for all
  using (public.can_see_clinical(patient_id)) with check (public.can_see_clinical(patient_id));

-- Templates: only their owner. Writes go through save_template (snapshots);
-- the owner can rename, favourite, categorise and delete directly.
revoke insert, update on public.templates from authenticated;
grant update (name, category, description, tags, is_favorite) on public.templates to authenticated;
create policy templates_select on public.templates for select using (owner_id = auth.uid());
create policy templates_update on public.templates for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy templates_delete on public.templates for delete using (owner_id = auth.uid());

-- Plans: written through save_meal_plan / activate_meal_plan. The patient
-- sees plans that were given to them (active or previous), never drafts.
revoke insert, update on public.meal_plans from authenticated;
create policy meal_plans_select on public.meal_plans for select
  using (public.can_see_clinical(patient_id) or (status <> 'draft' and public.is_patient_self(patient_id)));
create policy meal_plans_delete on public.meal_plans for delete
  using (status = 'draft' and public.can_see_clinical(patient_id));

create trigger foods_touch before update on public.foods for each row execute function public.touch_updated_at();
create trigger patient_health_touch before update on public.patient_health for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.consultation_notes for each row execute function public.touch_updated_at();
create trigger templates_touch before update on public.templates for each row execute function public.touch_updated_at();
create trigger meal_plans_touch before update on public.meal_plans for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Foods and recipes
-- ---------------------------------------------------------------------------

-- Creates or updates a practice's own food (numbers from a label or a lab).
-- p_servings: [{ "label": "1 piece", "grams": 30 }]
create function public.save_food(
  p_practice_id uuid, p_id uuid default null, p_name text default null, p_brand text default null, p_category text default null,
  p_kcal numeric default null, p_protein numeric default null, p_carbs numeric default null, p_fat numeric default null,
  p_fiber numeric default null, p_sugar numeric default null, p_sodium numeric default null,
  p_allergens text[] default '{}', p_servings jsonb default '[]'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_clinician(p_practice_id) then
    raise exception 'Only dietitians can add foods.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Enter the food''s name.' using errcode = '22023';
  end if;
  if p_kcal is null or p_protein is null or p_carbs is null or p_fat is null then
    raise exception 'Energy, protein, carbs and fat are required.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.foods (practice_id, created_by, name, brand, category, source, source_ref,
      kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, allergens)
    values (p_practice_id, auth.uid(), trim(p_name), nullif(trim(p_brand), ''), coalesce(nullif(trim(p_category), ''), 'Other'),
      'practice', 'label', p_kcal, p_protein, p_carbs, p_fat, p_fiber, p_sugar, p_sodium, coalesce(p_allergens, '{}'))
    returning id into v_id;
  else
    update public.foods set name = trim(p_name), brand = nullif(trim(p_brand), ''),
      category = coalesce(nullif(trim(p_category), ''), 'Other'),
      kcal = p_kcal, protein_g = p_protein, carbs_g = p_carbs, fat_g = p_fat,
      fiber_g = p_fiber, sugar_g = p_sugar, sodium_mg = p_sodium, allergens = coalesce(p_allergens, '{}')
     where id = p_id and practice_id = p_practice_id and not is_recipe;
    if not found then
      raise exception 'Food not found.' using errcode = 'P0002';
    end if;
    delete from public.food_servings where food_id = v_id;
  end if;

  insert into public.food_servings (food_id, label, grams, sort)
  select v_id, trim(s ->> 'label'), (s ->> 'grams')::numeric, ord
    from jsonb_array_elements(coalesce(p_servings, '[]')) with ordinality as e(s, ord)
   where char_length(trim(coalesce(s ->> 'label', ''))) > 0 and (s ->> 'grams')::numeric > 0;
  return v_id;
end;
$$;

-- Recomputes a recipe's per-100 g nutrients and allergens from its ingredients.
create function public.recompute_recipe(p_recipe_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  with t as (
    select sum(ri.grams) as raw_g,
           sum(f.kcal * ri.grams / 100) as kcal, sum(f.protein_g * ri.grams / 100) as protein,
           sum(f.carbs_g * ri.grams / 100) as carbs, sum(f.fat_g * ri.grams / 100) as fat,
           sum(coalesce(f.fiber_g, 0) * ri.grams / 100) as fiber, sum(coalesce(f.sugar_g, 0) * ri.grams / 100) as sugar,
           sum(coalesce(f.sodium_mg, 0) * ri.grams / 100) as sodium,
           array(select distinct a from public.recipe_ingredients r2 join public.foods f2 on f2.id = r2.food_id,
                 unnest(f2.allergens) a where r2.recipe_id = p_recipe_id order by a) as allergens
      from public.recipe_ingredients ri join public.foods f on f.id = ri.food_id
     where ri.recipe_id = p_recipe_id
  )
  update public.foods r
     set kcal      = least(950, round(coalesce(t.kcal, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         protein_g = least(100, round(coalesce(t.protein, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         carbs_g   = least(100, round(coalesce(t.carbs, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         fat_g     = least(100, round(coalesce(t.fat, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         fiber_g   = least(100, round(coalesce(t.fiber, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         sugar_g   = least(100, round(coalesce(t.sugar, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2)),
         sodium_mg = round(coalesce(t.sodium, 0) * 100 / coalesce(r.recipe_yield_g, nullif(t.raw_g, 0), 1), 2),
         allergens = coalesce(t.allergens, '{}')
    from t
   where r.id = p_recipe_id
$$;

-- Creates or updates a practice recipe. p_ingredients: [{ "food_id", "grams", "note" }]
create function public.save_recipe(
  p_practice_id uuid, p_id uuid default null, p_name text default null, p_category text default null, p_yield_g numeric default null,
  p_servings integer default null, p_instructions text default null, p_ingredients jsonb default '[]'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_clinician(p_practice_id) then
    raise exception 'Only dietitians can save recipes.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give the recipe a name.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_ingredients, '[]')) = 0 then
    raise exception 'Add at least one ingredient.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_ingredients) i
     where not public.can_use_food((i ->> 'food_id')::uuid) or (i ->> 'food_id')::uuid = p_id
  ) then
    raise exception 'One of the ingredients is not available.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.foods (practice_id, created_by, name, category, source, source_ref, is_recipe,
      recipe_yield_g, recipe_servings, instructions)
    values (p_practice_id, auth.uid(), trim(p_name), coalesce(nullif(trim(p_category), ''), 'Recipes'), 'practice', 'recipe', true,
      p_yield_g, p_servings, nullif(trim(p_instructions), ''))
    returning id into v_id;
  else
    update public.foods set name = trim(p_name), category = coalesce(nullif(trim(p_category), ''), 'Recipes'),
      recipe_yield_g = p_yield_g, recipe_servings = p_servings, instructions = nullif(trim(p_instructions), '')
     where id = p_id and practice_id = p_practice_id and is_recipe;
    if not found then
      raise exception 'Recipe not found.' using errcode = 'P0002';
    end if;
    delete from public.recipe_ingredients where recipe_id = v_id;
    delete from public.food_servings where food_id = v_id;
  end if;

  insert into public.recipe_ingredients (recipe_id, food_id, grams, note, sort)
  select v_id, (i ->> 'food_id')::uuid, (i ->> 'grams')::numeric, nullif(trim(i ->> 'note'), ''), ord
    from jsonb_array_elements(p_ingredients) with ordinality as e(i, ord);

  perform public.recompute_recipe(v_id);

  -- "1 portion" = whole recipe / servings.
  if p_servings is not null then
    insert into public.food_servings (food_id, label, grams, sort)
    select v_id, '1 portion', round(coalesce(p_yield_g, sum(ri.grams)) / p_servings, 1), 0
      from public.recipe_ingredients ri where ri.recipe_id = v_id;
  end if;
  return v_id;
end;
$$;

-- Copies a library or practice recipe into the practice so it can be adjusted.
create function public.copy_recipe(p_practice_id uuid, p_recipe_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.foods;
  v_id uuid;
begin
  select * into r from public.foods where id = p_recipe_id and is_recipe;
  if r.id is null or not public.can_use_food(p_recipe_id) then
    raise exception 'Recipe not found.' using errcode = 'P0002';
  end if;
  v_id := public.save_recipe(
    p_practice_id, null, r.name || case when r.practice_id = p_practice_id then ' (copy)' else '' end,
    r.category, r.recipe_yield_g, r.recipe_servings, r.instructions,
    (select jsonb_agg(jsonb_build_object('food_id', food_id, 'grams', grams, 'note', note) order by sort)
       from public.recipe_ingredients where recipe_id = p_recipe_id)
  );
  update public.foods set aliases = r.aliases where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Snapshots
-- ---------------------------------------------------------------------------

-- One item: the food's current numbers for these grams. Alternatives (approved
-- swaps) are snapshotted the same way, one level deep.
create function public.nx_snapshot_item(p_item jsonb, p_depth integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  f public.foods;
  g numeric;
  alts jsonb := '[]';
begin
  select * into f from public.foods where id = (p_item ->> 'food_id')::uuid;
  if f.id is null or not public.can_use_food(f.id) then
    raise exception 'A food in this plan is not available: %', coalesce(p_item ->> 'name', p_item ->> 'food_id') using errcode = '22023';
  end if;
  g := round((p_item ->> 'grams')::numeric, 1);
  if g is null or g <= 0 or g > 5000 then
    raise exception 'Enter an amount in grams for %.', f.name using errcode = '22023';
  end if;
  if p_depth = 0 then
    select coalesce(jsonb_agg(public.nx_snapshot_item(a, 1) order by ord), '[]') into alts
      from jsonb_array_elements(coalesce(p_item -> 'alternatives', '[]')) with ordinality as e(a, ord);
    if jsonb_array_length(alts) > 10 then
      raise exception 'Up to 10 swaps per food.' using errcode = '22023';
    end if;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'food_id', f.id,
    'name', f.name,
    'grams', g,
    -- e.g. { "label": "1 cup", "qty": 1.5 }: how the amount is shown to the patient.
    'serving', p_item -> 'serving',
    'kcal', round(f.kcal * g / 100, 1),
    'protein_g', round(f.protein_g * g / 100, 1),
    'carbs_g', round(f.carbs_g * g / 100, 1),
    'fat_g', round(f.fat_g * g / 100, 1),
    'fiber_g', round(f.fiber_g * g / 100, 1),
    'allergens', to_jsonb(f.allergens),
    'alternatives', case when p_depth = 0 and jsonb_array_length(alts) > 0 then alts end
  ));
end;
$$;

create function public.nx_totals(p_items jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'kcal', coalesce(round(sum((i ->> 'kcal')::numeric)), 0),
    'protein_g', coalesce(round(sum((i ->> 'protein_g')::numeric), 1), 0),
    'carbs_g', coalesce(round(sum((i ->> 'carbs_g')::numeric), 1), 0),
    'fat_g', coalesce(round(sum((i ->> 'fat_g')::numeric), 1), 0),
    'fiber_g', coalesce(round(sum((i ->> 'fiber_g')::numeric), 1), 0)
  )
  from jsonb_array_elements(coalesce(p_items, '[]')) i
$$;

-- Validates a whole plan/template body and writes every number from the database.
create function public.nx_snapshot(p_content jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d jsonb;
  m jsonb;
  days jsonb := '[]';
  meals jsonb;
  items jsonb;
  day_items jsonb;
  all_days jsonb := '[]';
  n_days integer;
begin
  n_days := jsonb_array_length(coalesce(p_content -> 'days', '[]'));
  if n_days = 0 then
    raise exception 'Add at least one day.' using errcode = '22023';
  end if;
  if n_days > 84 then
    raise exception 'Up to 84 days (12 weeks) per plan.' using errcode = '22023';
  end if;

  for d in select value from jsonb_array_elements(p_content -> 'days') loop
    meals := '[]';
    day_items := '[]';
    if jsonb_array_length(coalesce(d -> 'meals', '[]')) > 12 then
      raise exception 'Up to 12 meals a day.' using errcode = '22023';
    end if;
    for m in select value from jsonb_array_elements(coalesce(d -> 'meals', '[]')) loop
      if coalesce(m ->> 'slot', '') not in ('breakfast', 'lunch', 'dinner', 'snack') then
        raise exception 'Each meal must be breakfast, lunch, dinner or a snack.' using errcode = '22023';
      end if;
      if jsonb_array_length(coalesce(m -> 'items', '[]')) > 40 then
        raise exception 'Up to 40 foods per meal.' using errcode = '22023';
      end if;
      select coalesce(jsonb_agg(public.nx_snapshot_item(i) order by ord), '[]') into items
        from jsonb_array_elements(coalesce(m -> 'items', '[]')) with ordinality as e(i, ord);
      meals := meals || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'key', coalesce(nullif(m ->> 'key', ''), gen_random_uuid()::text),
        'slot', m ->> 'slot',
        'name', left(nullif(trim(m ->> 'name'), ''), 60),
        'time', left(nullif(trim(m ->> 'time'), ''), 10),
        'notes', left(nullif(trim(m ->> 'notes'), ''), 500),
        'items', items,
        'totals', public.nx_totals(items)
      )));
      day_items := day_items || items;
    end loop;
    days := days || jsonb_build_array(jsonb_build_object(
      'label', left(coalesce(nullif(trim(d ->> 'label'), ''), 'Day ' || (jsonb_array_length(days) + 1)), 40),
      'meals', meals,
      'totals', public.nx_totals(day_items)
    ));
  end loop;

  -- Average day.
  select jsonb_build_object(
    'kcal', round(avg((x -> 'totals' ->> 'kcal')::numeric)),
    'protein_g', round(avg((x -> 'totals' ->> 'protein_g')::numeric), 1),
    'carbs_g', round(avg((x -> 'totals' ->> 'carbs_g')::numeric), 1),
    'fat_g', round(avg((x -> 'totals' ->> 'fat_g')::numeric), 1),
    'fiber_g', round(avg((x -> 'totals' ->> 'fiber_g')::numeric), 1)
  ) into all_days from jsonb_array_elements(days) x;

  return jsonb_build_object('days', days, 'totals', all_days);
end;
$$;

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create function public.save_template(
  p_practice_id uuid, p_id uuid default null, p_kind public.template_kind default null, p_name text default null,
  p_category text default null, p_description text default null, p_content jsonb default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_content jsonb;
begin
  if not public.is_clinician(p_practice_id) then
    raise exception 'Only dietitians have templates.' using errcode = '42501';
  end if;
  if p_kind is null then
    raise exception 'Choose a template type.' using errcode = '22023';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give the template a name.' using errcode = '22023';
  end if;
  v_content := public.nx_snapshot(p_content);
  if p_kind = 'meal' and (jsonb_array_length(v_content -> 'days') <> 1 or jsonb_array_length(v_content -> 'days' -> 0 -> 'meals') <> 1) then
    raise exception 'A meal template holds exactly one meal.' using errcode = '22023';
  end if;
  if p_kind = 'day' and jsonb_array_length(v_content -> 'days') <> 1 then
    raise exception 'A daily template holds exactly one day.' using errcode = '22023';
  end if;
  if p_kind = 'week' and jsonb_array_length(v_content -> 'days') > 7 then
    raise exception 'A weekly template holds up to 7 days.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.templates (practice_id, owner_id, kind, name, category, description, content)
    values (p_practice_id, auth.uid(), p_kind, trim(p_name), nullif(trim(p_category), ''), nullif(trim(p_description), ''), v_content)
    returning id into v_id;
  else
    update public.templates set kind = p_kind, name = trim(p_name), category = nullif(trim(p_category), ''),
      description = nullif(trim(p_description), ''), content = v_content
     where id = p_id and owner_id = auth.uid();
    if not found then
      raise exception 'Template not found.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.duplicate_template(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.templates (practice_id, owner_id, kind, name, category, description, tags, content)
  select practice_id, owner_id, kind, left(name || ' (copy)', 120), category, description, tags, content
    from public.templates where id = p_id and owner_id = auth.uid()
  returning id into v_id;
  if v_id is null then
    raise exception 'Template not found.' using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Meal plans
-- ---------------------------------------------------------------------------

create function public.save_meal_plan(
  p_patient_id uuid, p_id uuid default null, p_name text default null, p_starts_on date default null, p_ends_on date default null,
  p_targets jsonb default '{}', p_notes text default null, p_content jsonb default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_content jsonb;
  v_targets jsonb;
begin
  if not public.can_see_clinical(p_patient_id) then
    raise exception 'You can''t edit this patient''s plans.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give the plan a name.' using errcode = '22023';
  end if;
  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'The plan can''t end before it starts.' using errcode = '22023';
  end if;
  v_content := public.nx_snapshot(p_content);
  -- Keep only known, positive targets.
  select coalesce(jsonb_object_agg(k, round(v::numeric)), '{}') into v_targets
    from jsonb_each_text(coalesce(p_targets, '{}')) t(k, v)
   where k in ('kcal', 'protein_g', 'carbs_g', 'fat_g') and v ~ '^\d+(\.\d+)?$' and v::numeric > 0;

  if p_id is null then
    insert into public.meal_plans (patient_id, name, starts_on, ends_on, targets, notes, content, created_by)
    values (p_patient_id, trim(p_name), p_starts_on, p_ends_on, v_targets, nullif(trim(p_notes), ''), v_content, auth.uid())
    returning id into v_id;
  else
    update public.meal_plans set name = trim(p_name), starts_on = p_starts_on, ends_on = p_ends_on,
      targets = v_targets, notes = nullif(trim(p_notes), ''), content = v_content
     where id = p_id and patient_id = p_patient_id and status <> 'archived';
    if not found then
      raise exception 'Plan not found, or it was archived (previous plans stay as they were).' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- Copies a template (owned by the caller) into a new draft plan for the patient.
create function public.plan_from_template(p_patient_id uuid, p_template_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t public.templates;
  v_id uuid;
begin
  select * into t from public.templates where id = p_template_id and owner_id = auth.uid();
  if t.id is null then
    raise exception 'Template not found.' using errcode = 'P0002';
  end if;
  v_id := public.save_meal_plan(p_patient_id, null, t.name, null, null, '{}', null, t.content);
  update public.meal_plans set source_template_id = t.id where id = v_id;
  return v_id;
end;
$$;

-- Saves a plan's content as a new template in the caller's private library.
create function public.template_from_plan(p_plan_id uuid, p_name text, p_kind public.template_kind)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  p public.meal_plans;
  v_practice uuid;
begin
  select * into p from public.meal_plans where id = p_plan_id;
  if p.id is null or not public.can_see_clinical(p.patient_id) then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  select practice_id into v_practice from public.patients where id = p.patient_id;
  return public.save_template(v_practice, null, p_kind, p_name, null, null, p.content);
end;
$$;

-- Gives the plan to the patient. Their previous active plan becomes a previous plan.
create function public.activate_meal_plan(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.meal_plans;
begin
  select * into p from public.meal_plans where id = p_id;
  if p.id is null or not public.can_see_clinical(p.patient_id) then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
  update public.meal_plans set status = 'archived' where patient_id = p.patient_id and status = 'active' and id <> p_id;
  update public.meal_plans set status = 'active', activated_at = now(),
    starts_on = coalesce(starts_on, current_date)
   where id = p_id;
end;
$$;

create function public.archive_meal_plan(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.meal_plans set status = 'archived'
   where id = p_id and status = 'active' and public.can_see_clinical(patient_id);
  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.nx_snapshot(jsonb), public.nx_snapshot_item(jsonb, integer),
  public.recompute_recipe(uuid) from public, anon, authenticated;
revoke execute on function
  public.save_food(uuid, uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text[], jsonb),
  public.save_recipe(uuid, uuid, text, text, numeric, integer, text, jsonb),
  public.copy_recipe(uuid, uuid),
  public.save_template(uuid, uuid, public.template_kind, text, text, text, jsonb),
  public.duplicate_template(uuid),
  public.save_meal_plan(uuid, uuid, text, date, date, jsonb, text, jsonb),
  public.plan_from_template(uuid, uuid),
  public.template_from_plan(uuid, text, public.template_kind),
  public.activate_meal_plan(uuid),
  public.archive_meal_plan(uuid)
  from public, anon;
grant execute on function
  public.save_food(uuid, uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text[], jsonb),
  public.save_recipe(uuid, uuid, text, text, numeric, integer, text, jsonb),
  public.copy_recipe(uuid, uuid),
  public.save_template(uuid, uuid, public.template_kind, text, text, text, jsonb),
  public.duplicate_template(uuid),
  public.save_meal_plan(uuid, uuid, text, date, date, jsonb, text, jsonb),
  public.plan_from_template(uuid, uuid),
  public.template_from_plan(uuid, text, public.template_kind),
  public.activate_meal_plan(uuid),
  public.archive_meal_plan(uuid)
  to authenticated;
