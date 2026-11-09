-- WhatsApp: each practice can send from its own WhatsApp Business API number,
-- or from the default Nutrix number. Two more automatic messages (app invite,
-- intake form), and the log records which number sent each message.

alter table public.whatsapp_log drop constraint whatsapp_log_kind_check;
alter table public.whatsapp_log add constraint whatsapp_log_kind_check
  check (kind in ('appointment_reminder', 'appointment_confirmed', 'payment_received', 'package_expiring', 'plan_ready', 'app_invite', 'intake_form'));
alter table public.whatsapp_log add column sender text not null default 'nutrix' check (sender in ('nutrix', 'own'));

-- A practice's own keys. No policies: read by the server only; the owner sets
-- them through practice_set_whatsapp and never reads the token back.
create table public.practice_whatsapp (
  practice_id      uuid primary key references public.practices (id) on delete cascade,
  use_own          boolean not null default false,
  token            text not null default '',
  phone_number_id  text not null default '',
  updated_at       timestamptz not null default now()
);
alter table public.practice_whatsapp enable row level security;
revoke all on public.practice_whatsapp from anon, authenticated;

-- Owner only. A blank token keeps the saved one; p_use_own false goes back to
-- the Nutrix number (the saved keys are kept for later).
create function public.practice_set_whatsapp(p_practice_id uuid, p_use_own boolean, p_phone_number_id text default null, p_token text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_practice_role(p_practice_id) is distinct from 'owner' then
    raise exception 'Only the practice owner can change WhatsApp settings.' using errcode = '42501';
  end if;
  if p_phone_number_id is not null and trim(p_phone_number_id) <> '' and trim(p_phone_number_id) !~ '^\d{6,20}$' then
    raise exception 'The phone number ID is the long number from WhatsApp Manager.' using errcode = '22023';
  end if;
  insert into public.practice_whatsapp (practice_id, use_own, phone_number_id, token)
  values (p_practice_id, coalesce(p_use_own, false), trim(coalesce(p_phone_number_id, '')), trim(coalesce(p_token, '')))
  on conflict (practice_id) do update
    set use_own = coalesce(p_use_own, false),
        phone_number_id = case when p_phone_number_id is null then public.practice_whatsapp.phone_number_id else trim(p_phone_number_id) end,
        token = case when trim(coalesce(p_token, '')) = '' then public.practice_whatsapp.token else trim(p_token) end,
        updated_at = now();
  if p_use_own and not exists (select 1 from public.practice_whatsapp where practice_id = p_practice_id and token <> '' and phone_number_id <> '') then
    raise exception 'Enter the phone number ID and access token of your WhatsApp number.' using errcode = '22023';
  end if;
end;
$$;

-- What the owner and assistants may see: which number sends, never the token.
create function public.practice_whatsapp_status(p_practice_id uuid)
returns table (use_own boolean, has_own_keys boolean, phone_number_id text, nutrix_ready boolean)
language sql stable security definer set search_path = ''
as $$
  select coalesce(pw.use_own, false),
         coalesce(pw.token <> '' and pw.phone_number_id <> '', false),
         coalesce(pw.phone_number_id, ''),
         exists (select 1 from public.platform_secrets where whatsapp_token <> '' and whatsapp_phone_number_id <> '')
    from (select 1) x
    left join public.practice_whatsapp pw on pw.practice_id = p_practice_id
   where public.is_billing(p_practice_id)
$$;

revoke execute on function public.practice_set_whatsapp(uuid, boolean, text, text), public.practice_whatsapp_status(uuid) from public, anon;
grant execute on function public.practice_set_whatsapp(uuid, boolean, text, text), public.practice_whatsapp_status(uuid) to authenticated;
