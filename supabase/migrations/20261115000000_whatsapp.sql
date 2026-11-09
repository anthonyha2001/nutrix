-- Automatic WhatsApp messages (Meta WhatsApp Cloud API), like Gymix.
-- Each message kind is a template approved in WhatsApp Manager, in English and
-- Arabic (see README). Keys are set by the super admin; without them nothing
-- is sent. Every message is logged once per (kind, ref), so nothing repeats.

-- Server-only keys (no policies: service role only).
create table public.platform_secrets (
  id                        boolean primary key default true check (id),
  whatsapp_token            text not null default '',
  whatsapp_phone_number_id  text not null default '',
  updated_at                timestamptz not null default now()
);
insert into public.platform_secrets (id) values (true);
alter table public.platform_secrets enable row level security;
revoke all on public.platform_secrets from anon, authenticated;

-- Super admin sets the keys; a blank token keeps the saved one.
create function public.admin_set_whatsapp_keys(p_token text, p_phone_number_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.nx_require_platform_admin();
  update public.platform_secrets
     set whatsapp_phone_number_id = trim(coalesce(p_phone_number_id, '')),
         whatsapp_token = case when trim(coalesce(p_token, '')) = '' then whatsapp_token else trim(p_token) end,
         updated_at = now()
   where id;
end;
$$;

create function public.admin_whatsapp_configured()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() and exists (select 1 from public.platform_secrets where whatsapp_token <> '' and whatsapp_phone_number_id <> '')
$$;

create table public.whatsapp_log (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices (id) on delete cascade,
  patient_id   uuid references public.patients (id) on delete set null,
  kind         text not null check (kind in ('appointment_reminder', 'appointment_confirmed', 'payment_received', 'package_expiring', 'plan_ready')),
  ref          text not null,
  lang         text not null default 'en' check (lang in ('en', 'ar')),
  to_phone     text,
  body         text not null,
  status       text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  unique (kind, ref)
);
create index whatsapp_log_practice_idx on public.whatsapp_log (practice_id, created_at desc);
alter table public.whatsapp_log enable row level security;
revoke all on public.whatsapp_log from anon;
revoke insert, update, delete on public.whatsapp_log from authenticated;
-- The owner and assistants see what was sent (dietitians: their own patients).
create policy whatsapp_log_select on public.whatsapp_log for select
  using (public.is_billing(practice_id) or (patient_id is not null and public.can_see_clinical(patient_id)));

-- On for everyone; nothing is sent until the keys are set.
insert into public.features (key, name, description, rollout) values
  ('whatsapp', 'Automatic WhatsApp', 'Appointment reminders and confirmations, payment receipts, package endings and new plans, sent from the Nutrix WhatsApp number.', 'all')
on conflict (key) do nothing;

revoke execute on function public.admin_set_whatsapp_keys(text, text), public.admin_whatsapp_configured() from public, anon;
grant execute on function public.admin_set_whatsapp_keys(text, text), public.admin_whatsapp_configured() to authenticated;

-- Hourly: scheduled messages (appointment reminders, package endings). The
-- address is read from platform_config (key whatsapp_url) with cron_secret.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('nutrix-whatsapp', '5 * * * *', $job$
      select net.http_post(
        url := (select value from public.platform_config where key = 'whatsapp_url'),
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from public.platform_config where key = 'cron_secret')),
        body := '{}'::jsonb
      )
      where exists (select 1 from public.platform_config where key = 'whatsapp_url')
        and exists (select 1 from public.platform_config where key = 'cron_secret')
    $job$);
  end if;
end;
$do$;
