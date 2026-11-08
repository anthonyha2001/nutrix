-- Patient app: language (English or Arabic), Arabic food names for patients,
-- and meal reminders (web push).

-- Interface language; null = follow the phone's language.
alter table public.profiles add column locale text check (locale in ('en', 'ar'));
grant update (locale) on public.profiles to authenticated;

-- Patients read the confirmed food names of the library and of their practice.
create policy food_translations_select_patient on public.food_translations for select
  using (practice_id is not null and exists (
    select 1 from public.patients p where p.user_id = auth.uid() and p.practice_id = food_translations.practice_id and p.archived_at is null
  ));

-- ---------------------------------------------------------------------------
-- Meal reminders
-- ---------------------------------------------------------------------------

-- One row per phone or browser that asked for reminders.
create table public.push_subscriptions (
  endpoint    text primary key check (endpoint ~ '^https://'),
  user_id     uuid not null references auth.users (id) on delete cascade,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_patient_idx on public.push_subscriptions (patient_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke update on public.push_subscriptions from authenticated;
create policy push_select_own on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions for insert
  with check (user_id = auth.uid() and public.is_patient_self(patient_id));
create policy push_delete_own on public.push_subscriptions for delete using (user_id = auth.uid());

-- Reminders already sent, so a meal is never announced twice.
create table public.meal_reminders_sent (
  patient_id  uuid not null references public.patients (id) on delete cascade,
  day         date not null,
  meal_key    text not null,
  sent_at     timestamptz not null default now(),
  primary key (patient_id, day, meal_key)
);
alter table public.meal_reminders_sent enable row level security;
revoke all on public.meal_reminders_sent from anon, authenticated;

-- Server-only settings (no policies: service role only).
create table public.platform_config (
  key    text primary key,
  value  text not null
);
alter table public.platform_config enable row level security;
revoke all on public.platform_config from anon, authenticated;

-- Every 10 minutes, ask the web app to send the reminders that are due. The
-- app's address and shared secret are read from platform_config at run time
-- (keys reminder_url and cron_secret), so nothing secret is in this file.
-- Skipped where pg_cron / pg_net aren't available (plain Postgres in tests).
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('nutrix-meal-reminders', '*/10 * * * *', $job$
      select net.http_post(
        url := (select value from public.platform_config where key = 'reminder_url'),
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from public.platform_config where key = 'cron_secret')),
        body := '{}'::jsonb
      )
      where exists (select 1 from public.platform_config where key = 'reminder_url')
        and exists (select 1 from public.platform_config where key = 'cron_secret')
    $job$);
  end if;
end;
$do$;
