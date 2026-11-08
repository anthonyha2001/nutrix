-- Food names in Arabic and French for printed plans.
--
-- A plan is printed in English, French or Arabic. Fixed words are translated in
-- the app; food names come from this table: Nutrix ships checked names for its
-- Lebanese dishes (practice_id null), and each practice confirms names for the
-- other foods it uses, once, then they are reused for every patient. A food
-- without a confirmed name prints in its original language, never as a guess.

create table public.food_translations (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid references public.practices (id) on delete cascade,
  food_id      uuid not null references public.foods (id) on delete cascade,
  lang         text not null check (lang in ('ar', 'fr')),
  name         text not null check (char_length(trim(name)) between 1 and 200),
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);

create unique index food_translations_practice on public.food_translations (practice_id, food_id, lang) where practice_id is not null;
create unique index food_translations_global on public.food_translations (food_id, lang) where practice_id is null;

alter table public.food_translations enable row level security;
revoke all on public.food_translations from anon;
revoke insert, update, delete on public.food_translations from authenticated;
create policy food_translations_select on public.food_translations for select
  using (practice_id is null or public.is_practice_staff(practice_id));

-- A clinician confirms (or corrects) a food's name for their practice.
create function public.save_food_translation(p_practice_id uuid, p_food_id uuid, p_lang text, p_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_clinician(p_practice_id) then
    raise exception 'Only the clinical team can name foods.' using errcode = '42501';
  end if;
  if p_lang not in ('ar', 'fr') then
    raise exception 'Unknown language.' using errcode = '22023';
  end if;
  if coalesce(trim(p_name), '') = '' then
    delete from public.food_translations where practice_id = p_practice_id and food_id = p_food_id and lang = p_lang;
    return;
  end if;
  insert into public.food_translations (practice_id, food_id, lang, name, updated_by)
  values (p_practice_id, p_food_id, p_lang, left(trim(p_name), 200), auth.uid())
  on conflict (practice_id, food_id, lang) where practice_id is not null
  do update set name = excluded.name, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

revoke execute on function public.save_food_translation(uuid, uuid, text, text) from public, anon;
grant execute on function public.save_food_translation(uuid, uuid, text, text) to authenticated;

-- Checked names for the Nutrix Lebanese dishes.
insert into public.food_translations (food_id, lang, name)
select f.id, t.lang, t.name
  from (values
    ('Tabbouleh', 'ar', 'تبولة'), ('Tabbouleh', 'fr', 'Taboulé'),
    ('Fattoush', 'ar', 'فتوش'), ('Fattoush', 'fr', 'Fattouche'),
    ('Hummus bi tahini', 'ar', 'حمص بطحينة'), ('Hummus bi tahini', 'fr', 'Houmous à la tahini'),
    ('Kibbeh bil saniyeh (baked)', 'ar', 'كبة بالصينية'), ('Kibbeh bil saniyeh (baked)', 'fr', 'Kebbé au plateau (au four)'),
    ('Mujaddara', 'ar', 'مجدرة'), ('Mujaddara', 'fr', 'Moujaddara'),
    ('Warak enab (vegetarian)', 'ar', 'ورق عنب بزيت'), ('Warak enab (vegetarian)', 'fr', 'Feuilles de vigne farcies (végétariennes)'),
    ('Fatteh hummus', 'ar', 'فتة حمص'), ('Fatteh hummus', 'fr', 'Fatté au houmous'),
    ('Manoushe za''atar', 'ar', 'منقوشة زعتر'), ('Manoushe za''atar', 'fr', 'Manouché au zaatar'),
    ('Kafta (grilled)', 'ar', 'كفتة مشوية'), ('Kafta (grilled)', 'fr', 'Kafta grillée'),
    ('Lentil soup (shorbet adas)', 'ar', 'شوربة عدس'), ('Lentil soup (shorbet adas)', 'fr', 'Soupe de lentilles')
  ) as t(dish, lang, name)
  join public.foods f on f.name = t.dish and f.source = 'nutrix' and f.practice_id is null
on conflict do nothing;
