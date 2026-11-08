-- Lebanese dishes as standard recipes in the shared library (source 'nutrix').
--
-- Each dish is a list of USDA ingredients with gram weights for one batch; its
-- nutrients are computed from those ingredients (public.recompute_recipe), so
-- no number here is typed in. Quantities are typical home recipes, written to
-- be reviewed and adjusted: a dietitian copies a dish into their practice
-- (Foods & recipes, "Copy to my recipes") to match how their patients cook it.
-- Where cooking removes water or fat (grilled or baked meat), recipe_yield_g is
-- the assumed cooked weight of the batch and the instructions say so.

create function pg_temp.library_recipe(
  p_name text, p_aliases text[], p_servings integer, p_yield_g numeric, p_notes text, p_ingredients jsonb
) returns void
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.foods (name, category, aliases, source, source_ref, is_recipe, recipe_servings, recipe_yield_g, instructions)
  values (p_name, 'Lebanese dishes', p_aliases, 'nutrix', 'Nutrix standard recipe', true, p_servings, p_yield_g, p_notes)
  returning id into v_id;

  insert into public.recipe_ingredients (recipe_id, food_id, grams, note, sort)
  select v_id, f.id, (i ->> 'g')::numeric, i ->> 'note', ord
    from jsonb_array_elements(p_ingredients) with ordinality as e(i, ord)
    join public.foods f on f.source = 'usda' and f.source_ref = i ->> 'usda';
  if (select count(*) from public.recipe_ingredients where recipe_id = v_id) <> jsonb_array_length(p_ingredients) then
    raise exception 'Missing USDA ingredient in %', p_name;
  end if;

  perform public.recompute_recipe(v_id);
  insert into public.food_servings (food_id, label, grams, sort)
  select v_id, '1 portion', round(coalesce(p_yield_g, sum(grams)) / p_servings, 1), 0
    from public.recipe_ingredients where recipe_id = v_id;
end;
$$;

select pg_temp.library_recipe('Tabbouleh', array['tabouleh', 'tabouli', 'tabboule'], 4, null,
  'Fine bulgur soaked in the tomato and lemon juice (dry weight). Weights as prepared.',
  '[{"usda":"170416","g":150,"note":"flat-leaf, finely chopped"},
    {"usda":"170457","g":200,"note":"diced"},
    {"usda":"170688","g":40,"note":"fine, dry"},
    {"usda":"170000","g":40},
    {"usda":"173475","g":10},
    {"usda":"167747","g":45},
    {"usda":"171413","g":40},
    {"usda":"173468","g":3}]');

select pg_temp.library_recipe('Fattoush', array['fatoush', 'fattouch'], 4, null,
  'Toasted pita (not fried). Sumac and pomegranate molasses add negligible energy and are left out.',
  '[{"usda":"169247","g":150},
    {"usda":"170457","g":150},
    {"usda":"168409","g":150},
    {"usda":"169276","g":50},
    {"usda":"170005","g":30},
    {"usda":"170416","g":30},
    {"usda":"173475","g":5},
    {"usda":"174915","g":60,"note":"toasted"},
    {"usda":"171413","g":40},
    {"usda":"167747","g":30},
    {"usda":"173468","g":3}]');

select pg_temp.library_recipe('Hummus bi tahini', array['hummus', 'houmous', 'hommos'], 6, null,
  'Cooked chickpeas blended with tahini, lemon and garlic; olive oil drizzle included.',
  '[{"usda":"173757","g":400,"note":"cooked"},
    {"usda":"170189","g":90},
    {"usda":"167747","g":60},
    {"usda":"169230","g":10},
    {"usda":"171413","g":15},
    {"usda":"173468","g":4}]');

select pg_temp.library_recipe('Kibbeh bil saniyeh (baked)', array['kibbeh', 'kibbe', 'kebbeh', 'baked kibbeh'], 8, 1300,
  'Shell of fine bulgur and lean beef, filling of beef, onion and pine nuts, baked with olive oil. Assumed cooked weight 1300 g for the batch (1514 g raw, bulgur as dry weight).',
  '[{"usda":"174030","g":500,"note":"shell, 90% lean"},
    {"usda":"170688","g":250,"note":"fine, dry, soaked"},
    {"usda":"170000","g":250,"note":"shell and filling"},
    {"usda":"174036","g":400,"note":"filling, 80% lean"},
    {"usda":"170591","g":40},
    {"usda":"171413","g":60},
    {"usda":"171315","g":4},
    {"usda":"173468","g":10}]');

select pg_temp.library_recipe('Mujaddara', array['mujadara', 'mjadra', 'moujadara'], 6, 1250,
  'Brown lentils and rice (cooked weights) with onions fried in olive oil. Assumed cooked weight 1250 g (onions lose about 60% of their weight when fried).',
  '[{"usda":"172421","g":600,"note":"cooked"},
    {"usda":"168878","g":400,"note":"cooked"},
    {"usda":"170000","g":400,"note":"sliced, fried"},
    {"usda":"171413","g":60},
    {"usda":"170923","g":3},
    {"usda":"173468","g":5}]');

select pg_temp.library_recipe('Warak enab (vegetarian)', array['warak enab', 'wara2 3enab', 'stuffed grape leaves', 'dolma'], 8, null,
  'Grape leaves rolled with rice, tomato, parsley and mint, cooked in olive oil and lemon (rice as cooked weight). About 5 rolls per portion.',
  '[{"usda":"169393","g":200},
    {"usda":"168878","g":500,"note":"cooked"},
    {"usda":"170457","g":300},
    {"usda":"170416","g":100},
    {"usda":"173475","g":15},
    {"usda":"170000","g":100},
    {"usda":"171413","g":100},
    {"usda":"167747","g":100},
    {"usda":"173468","g":6}]');

select pg_temp.library_recipe('Fatteh hummus', array['fatteh', 'fatte', 'fattet hummus'], 4, null,
  'Toasted pita, warm chickpeas, garlic yogurt with tahini, pine nuts fried in butter.',
  '[{"usda":"174915","g":120,"note":"toasted"},
    {"usda":"173757","g":300,"note":"cooked"},
    {"usda":"171284","g":400},
    {"usda":"170189","g":40},
    {"usda":"169230","g":8},
    {"usda":"167747","g":20},
    {"usda":"170591","g":20},
    {"usda":"173430","g":20},
    {"usda":"173468","g":3}]');

select pg_temp.library_recipe('Manoushe za''atar', array['manakish', 'manakeesh', 'manoucheh', 'zaatar manoushe'], 1, null,
  'One manoushe: pita-style dough base with za''atar (thyme and sesame) and olive oil. Sumac left out (negligible energy).',
  '[{"usda":"174915","g":90,"note":"dough base"},
    {"usda":"171413","g":15},
    {"usda":"170938","g":5,"note":"za''atar"},
    {"usda":"170150","g":3,"note":"za''atar"}]');

select pg_temp.library_recipe('Kafta (grilled)', array['kafta', 'kofta', 'kefta', 'kafta meshwi'], 6, 490,
  'Ground beef with onion and parsley, grilled on skewers. Assumed cooked weight 490 g (25% lost on the grill from 653 g raw).',
  '[{"usda":"174036","g":500,"note":"80% lean"},
    {"usda":"170000","g":100,"note":"grated"},
    {"usda":"170416","g":40},
    {"usda":"171315","g":3},
    {"usda":"170931","g":2},
    {"usda":"173468","g":8}]');

select pg_temp.library_recipe('Lentil soup (shorbet adas)', array['lentil soup', 'shorbet adas', 'shorba', 'adas'], 6, 1800,
  'Red lentils simmered with onion and carrot, blended, finished with cumin and lemon. Assumed final weight 1800 g after simmering.',
  '[{"usda":"174284","g":250,"note":"dry"},
    {"usda":"170000","g":150},
    {"usda":"170393","g":100},
    {"usda":"171413","g":30},
    {"usda":"170923","g":3},
    {"usda":"167747","g":30},
    {"usda":"173647","g":1500,"note":"water"},
    {"usda":"173468","g":6}]');
