-- Hands-on demo, like Gymix: each visitor gets a private sample practice
-- (Cedar Nutrition) with a dietitian (owner) sign-in and a patient sign-in,
-- full of realistic data, deleted after 24 hours. WhatsApp is forced off.

alter table public.practices add column demo_expires_at timestamptz;
create index practices_demo_idx on public.practices (demo_expires_at) where demo_expires_at is not null;

create table public.demo_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  practice_id  uuid not null references public.practices (id) on delete cascade,
  role         text not null check (role in ('owner', 'patient'))
);
alter table public.demo_users enable row level security;
revoke all on public.demo_users from anon, authenticated;

create table public.demo_starts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index demo_starts_idx on public.demo_starts (ip_hash, created_at desc);
alter table public.demo_starts enable row level security;
revoke all on public.demo_starts from anon, authenticated;

-- Builds the sample practice. Runs as the owner (the request's user id is set
-- to them) so every rule and computation is the real one.
create function public.create_demo_practice(p_owner uuid, p_patient_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev     text := current_setting('request.jwt.claim.sub', true);
  v_practice uuid;
  v_today    date;
  v_tz       text := 'Asia/Beirut';
  v_lina     uuid;
  v_pid      uuid;
  v_plan     uuid;
  v_inv      uuid;
  v_follow   uuid;
  v_first    uuid;
  v_pack     uuid;
  v_appt     uuid;
  r          record;
  i          integer;
  f          jsonb := '{}';
begin
  perform set_config('request.jwt.claim.sub', p_owner::text, true);

  insert into public.practices (name, slug, created_by, timezone, demo_expires_at)
  values ('Cedar Nutrition', 'demo-' || substr(md5(random()::text), 1, 10), p_owner, v_tz, now() + interval '24 hours')
  returning id into v_practice;
  insert into public.practice_users (practice_id, user_id, role) values (v_practice, p_owner, 'owner');
  insert into public.demo_users (user_id, practice_id, role) values (p_owner, v_practice, 'owner'), (p_patient_user, v_practice, 'patient');
  -- Nothing ever leaves a demo.
  insert into public.practice_feature_overrides (practice_id, feature_key, enabled) values (v_practice, 'whatsapp', false)
  on conflict do nothing;
  v_today := (now() at time zone v_tz)::date;

  -- Foods used below, by name.
  for r in select name, id from public.foods where practice_id is null and name in (
    'Tabbouleh', 'Hummus bi tahini', 'Kafta (grilled)', 'Fattoush', 'Lentil soup (shorbet adas)', 'Manoushe za''atar', 'Mujaddara',
    'Yogurt, Greek, plain, whole milk', 'Bananas, raw', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'Nuts, almonds',
    'Bread, pita, whole-wheat', 'Cucumber, with peel, raw', 'Egg, whole, cooked, hard-boiled', 'Fish, salmon, Atlantic, farmed, cooked, dry heat',
    'Rice, white, long-grain, regular, enriched, cooked', 'Oil, olive, salad or cooking') loop
    f := f || jsonb_build_object(r.name, r.id);
  end loop;

  -- Catalogue.
  insert into public.services (practice_id, name, duration_min, price_usd) values (v_practice, 'First consultation', 60, 50) returning id into v_first;
  insert into public.services (practice_id, name, duration_min, price_usd) values (v_practice, 'Follow-up', 30, 30) returning id into v_follow;
  insert into public.package_types (practice_id, name, consultations, price_usd, valid_days) values (v_practice, '4 follow-ups', 4, 100, 60) returning id into v_pack;

  -- Patients.
  for r in select * from (values
    ('Lina Khoury', 'female', '1991-03-14', '71 234 567'),
    ('Karim Haddad', 'male', '1985-09-02', '03 456 789'),
    ('Maya Saab', 'female', '1998-12-21', '76 112 233'),
    ('Rami Nassar', 'male', '1979-06-30', '70 998 877'),
    ('Nour Aoun', 'female', '2001-01-09', '81 445 566'),
    ('Joseph Daher', 'male', '1968-11-17', '03 222 111'),
    ('Rita Salameh', 'female', '1994-07-25', '71 765 432'),
    ('Hadi Mansour', 'male', '1990-04-03', '76 334 455'),
    ('Sara Fakhoury', 'female', '1987-02-11', '70 556 677'),
    ('Elie Rizk', 'male', '1996-10-28', '81 667 788'),
    ('Dana Hamdan', 'female', '1983-05-19', '03 889 900'),
    ('Tarek Zein', 'male', '1975-08-07', '71 101 202')
  ) as t(name, sex, dob, phone) loop
    insert into public.patients (practice_id, dietitian_id, full_name, sex, date_of_birth, phone, user_id)
    values (v_practice, p_owner, r.name, r.sex::public.sex, r.dob::date, r.phone, case when r.name = 'Lina Khoury' then p_patient_user end)
    returning id into v_pid;
    if r.name = 'Lina Khoury' then v_lina := v_pid; end if;
    -- A first weigh-in for everyone.
    insert into public.measurements (patient_id, measured_on, weight_kg, body_fat_pct, recorded_by)
    values (v_pid, v_today - (20 + (random() * 40)::int), round((58 + random() * 40)::numeric, 1), round((20 + random() * 15)::numeric, 1), p_owner);
  end loop;

  -- Lina: the full file.
  insert into public.patient_health (patient_id, height_cm, activity_level, goal, medical_history, nutrition_history, lifestyle, updated_by)
  values (v_lina, 165, 'light', 'Lose 6 kg before summer and keep it off',
          'Mild insulin resistance (HbA1c 5.8%). No medication.',
          'Skips breakfast, large late dinners, sweet coffee twice a day. Loves Lebanese food.',
          'Office job, walks 20 minutes on weekdays, sleeps about 6.5 hours.', p_owner);
  insert into public.patient_allergies (patient_id, allergen, kind, severity) values (v_lina, 'tree_nut', 'intolerance', 'mild');
  for i in 0..6 loop
    insert into public.measurements (patient_id, measured_on, weight_kg, body_fat_pct, waist_cm, recorded_by)
    values (v_lina, v_today - (42 - i * 7), round((74.6 - i * 0.55 - random() * 0.2)::numeric, 1), round((33.5 - i * 0.35)::numeric, 1), round((88 - i * 0.8)::numeric, 1), p_owner);
  end loop;
  insert into public.consultation_notes (patient_id, author_id, noted_on, title, body) values
    (v_lina, p_owner, v_today - 42, 'First consultation', 'Goal: lose 6 kg. Skips breakfast, eats late. Agreed: breakfast within an hour of waking, dinner before 8:30 pm, unsweetened coffee.'),
    (v_lina, p_owner, v_today - 14, 'Follow-up, week 4', 'Down 2.2 kg. Breakfast every day. Struggles on weekends: added a fattoush swap for Saturday lunch. Keep walking.');

  -- Her plan: built and given through the real functions (numbers computed by the database).
  v_plan := public.save_meal_plan(v_lina, null, 'Mediterranean, 1,600 kcal', v_today - 14, null,
    '{"kcal": 1600, "protein_g": 100, "carbs_g": 180, "fat_g": 55}'::jsonb,
    'Drink 2 litres of water a day. Coffee without sugar. Walk 30 minutes after dinner when you can.',
    jsonb_build_object('days', jsonb_build_array(jsonb_build_object('label', 'Every day', 'meals', jsonb_build_array(
      jsonb_build_object('key', 'b', 'slot', 'breakfast', 'time', '08:00', 'items', jsonb_build_array(
        jsonb_build_object('food_id', f ->> 'Yogurt, Greek, plain, whole milk', 'grams', 170),
        jsonb_build_object('food_id', f ->> 'Bread, pita, whole-wheat', 'grams', 40),
        jsonb_build_object('food_id', f ->> 'Cucumber, with peel, raw', 'grams', 100),
        jsonb_build_object('food_id', f ->> 'Egg, whole, cooked, hard-boiled', 'grams', 50))),
      jsonb_build_object('key', 'l', 'slot', 'lunch', 'time', '13:30', 'items', jsonb_build_array(
        jsonb_build_object('food_id', f ->> 'Tabbouleh', 'grams', 200,
          'alternatives', jsonb_build_array(jsonb_build_object('food_id', f ->> 'Fattoush', 'grams', 250))),
        jsonb_build_object('food_id', f ->> 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'grams', 120),
        jsonb_build_object('food_id', f ->> 'Oil, olive, salad or cooking', 'grams', 15))),
      jsonb_build_object('key', 's', 'slot', 'snack', 'time', '17:00', 'items', jsonb_build_array(
        jsonb_build_object('food_id', f ->> 'Bananas, raw', 'grams', 120))),
      jsonb_build_object('key', 'd', 'slot', 'dinner', 'time', '20:00', 'items', jsonb_build_array(
        jsonb_build_object('food_id', f ->> 'Lentil soup (shorbet adas)', 'grams', 300),
        jsonb_build_object('food_id', f ->> 'Rice, white, long-grain, regular, enriched, cooked', 'grams', 120),
        jsonb_build_object('food_id', f ->> 'Hummus bi tahini', 'grams', 60,
          'alternatives', jsonb_build_array(jsonb_build_object('food_id', f ->> 'Fish, salmon, Atlantic, farmed, cooked, dry heat', 'grams', 100))))))))));
  perform public.activate_meal_plan(v_plan);

  -- A private template of the dietitian.
  perform public.save_template(v_practice, null, 'day', 'Lebanese day, 1,400 kcal', 'Weight loss', null,
    jsonb_build_object('days', jsonb_build_array(jsonb_build_object('label', 'Day 1', 'meals', jsonb_build_array(
      jsonb_build_object('slot', 'breakfast', 'items', jsonb_build_array(jsonb_build_object('food_id', f ->> 'Manoushe za''atar', 'grams', 113))),
      jsonb_build_object('slot', 'lunch', 'items', jsonb_build_array(jsonb_build_object('food_id', f ->> 'Mujaddara', 'grams', 250), jsonb_build_object('food_id', f ->> 'Fattoush', 'grams', 200))),
      jsonb_build_object('slot', 'dinner', 'items', jsonb_build_array(jsonb_build_object('food_id', f ->> 'Kafta (grilled)', 'grams', 120), jsonb_build_object('food_id', f ->> 'Tabbouleh', 'grams', 150))))))));

  -- Her last three days in the diary, check-ins and water.
  for i in 1..3 loop
    insert into public.diary_entries (patient_id, eaten_on, slot, food_id, name, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, source, plan_meal_key)
    select v_lina, v_today - i, x.slot, fo.id, fo.name, x.g,
           round(fo.kcal * x.g / 100, 1), round(fo.protein_g * x.g / 100, 1), round(fo.carbs_g * x.g / 100, 1), round(fo.fat_g * x.g / 100, 1),
           round(coalesce(fo.fiber_g, 0) * x.g / 100, 1), x.src::public.diary_source, x.k
      from (values
        ('breakfast', 'Yogurt, Greek, plain, whole milk', 170, 'plan', 'b'),
        ('breakfast', 'Bread, pita, whole-wheat', 40, 'plan', 'b'),
        ('lunch', case when i = 2 then 'Fattoush' else 'Tabbouleh' end, case when i = 2 then 250 else 200 end, case when i = 2 then 'swap' else 'plan' end, 'l'),
        ('lunch', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 120, 'plan', 'l'),
        ('dinner', 'Lentil soup (shorbet adas)', 300, 'plan', 'd')
      ) as x(slot, fname, g, src, k)
      join public.foods fo on fo.id = (f ->> x.fname)::uuid;
    insert into public.daily_checkins (patient_id, day, mood, energy, hunger, sleep_hours, followed_plan, water_ml, checked_in_at, note)
    values (v_lina, v_today - i, 3 + (i % 2), 3 + ((i + 1) % 2), 2, 6.5 + i * 0.3, 4, 1500 + i * 250, now() - make_interval(days => i),
            case when i = 2 then 'Lunch out with colleagues, took the fattoush swap.' end);
  end loop;
  insert into public.daily_checkins (patient_id, day, water_ml) values (v_lina, v_today, 750);

  -- Appointments: past (attended), today, tomorrow, and a request.
  for r in select p.id, p.full_name, row_number() over (order by p.full_name) as n from public.patients p where p.practice_id = v_practice loop
    if r.n <= 4 then
      v_appt := public.book_appointment(r.id, ((v_today + 0)::timestamp + make_interval(hours => 9 + r.n::int * 2)) at time zone v_tz, null, v_follow);
    elsif r.n <= 7 then
      v_appt := public.book_appointment(r.id, ((v_today + 1)::timestamp + make_interval(hours => 8 + r.n::int)) at time zone v_tz, null, v_follow);
    elsif r.n <= 10 then
      v_appt := public.book_appointment(r.id, ((v_today - 3 - r.n::int)::timestamp + make_interval(hours => 11)) at time zone v_tz, null, v_first);
      perform public.complete_appointment(v_appt);
    end if;
  end loop;
  insert into public.appointments (practice_id, patient_id, dietitian_id, starts_at, ends_at, status, patient_note, created_by)
  values (v_practice, v_lina, p_owner, ((v_today + 3)::timestamp + interval '17 hours') at time zone v_tz, ((v_today + 3)::timestamp + interval '17 hours 45 minutes') at time zone v_tz,
          'requested', 'Evenings are better for me', p_patient_user);

  -- Money: Lina's package, partly paid in LBP; the attended visits billed, some paid.
  v_inv := public.sell_package(v_lina, v_pack, v_today - 14);
  perform public.record_payment(v_inv, 'cash_lbp', null, 4475000);
  for r in select id from public.invoices where practice_id = v_practice and appointment_id is not null order by number limit 2 loop
    perform public.record_payment(r.id, 'whish', 50);
  end loop;

  -- Messages.
  insert into public.messages (patient_id, sender_id, from_patient, body, created_at, read_at) values
    (v_lina, p_owner, false, 'Hi Lina, your new plan is in the app. Tell me how the first week goes.', now() - interval '6 days', now() - interval '6 days'),
    (v_lina, p_patient_user, true, 'Thank you! Can I swap the tabbouleh when I eat out?', now() - interval '2 days', now() - interval '2 days'),
    (v_lina, p_owner, false, 'Yes: take the fattoush, same portion. It is already in your swaps.', now() - interval '2 days', now() - interval '1 day'),
    (v_lina, p_patient_user, true, 'Perfect, down another half kilo this week.', now() - interval '3 hours', null);

  perform set_config('request.jwt.claim.sub', coalesce(v_prev, ''), true);
  return v_practice;
end;
$$;

-- Sample practices past their 24 hours, with their sign-ins.
create function public.expired_demo_practices(p_limit integer default 25)
returns table (practice_id uuid, user_ids uuid[])
language sql stable security definer set search_path = ''
as $$
  select pr.id, array(select du.user_id from public.demo_users du where du.practice_id = pr.id)
    from public.practices pr
   where pr.demo_expires_at is not null and pr.demo_expires_at < now()
   order by pr.demo_expires_at
   limit p_limit
$$;

revoke execute on function public.create_demo_practice(uuid, uuid), public.expired_demo_practices(integer) from public, anon, authenticated;
