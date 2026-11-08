-- Platform super admin: overview, support access, lab, feature switches.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('admin@nutrix.app', '{"full_name":"Platform Admin"}'),
  ('olivia@test.lb', '{"full_name":"Olivia Owner"}');
insert into public.platform_admins (user_id) select id from auth.users where email = 'admin@nutrix.app';

select pg_temp.act_as('olivia@test.lb');
select public.create_practice('Beirut Nutrition Clinic') as practice_id \gset
select set_config('test.practice', :'practice_id', false);
insert into public.patients (practice_id, dietitian_id, full_name) values (:'practice_id', auth.uid(), 'Lina Patient');

-- Regular users can't use admin functions.
do $$ begin
  assert not public.is_platform_admin(), 'owner is not a platform admin';
  begin
    perform * from public.admin_practice_overview();
    assert false, 'overview needs admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_rollout('messages', 'off');
    assert false, 'rollout needs admin';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The admin sees numbers, not patients, until they open the practice.
select pg_temp.act_as('admin@nutrix.app');
do $$ begin
  assert (select patients from public.admin_practice_overview() where name = 'Beirut Nutrition Clinic') = 1, 'overview counts patients';
  assert (select count(*) from public.patients) = 0, 'no patient data without opening the practice';
end $$;

select public.admin_open_practice(:'practice_id', 'assistant');
do $$ begin
  assert public.my_practice_role(current_setting('test.practice')::uuid) = 'assistant', 'acts as assistant';
  assert (select count(*) from public.patients) = 1, 'assistant sees the patient list';
  assert not public.can_see_clinical((select id from public.patients limit 1)), 'assistant: no clinical access';
end $$;

select public.admin_open_practice(:'practice_id', 'owner');
do $$ begin
  assert public.can_see_clinical((select id from public.patients limit 1)), 'owner view: clinical access';
  begin
    perform public.admin_open_practice(current_setting('test.practice')::uuid, 'patient');
    assert false, 'patient view only in a lab';
  exception when invalid_parameter_value then null;
  end;
end $$;

select public.admin_leave_practice();
do $$ begin
  assert (select count(*) from public.patients) = 0, 'leaving ends access';
  assert public.my_practice_role(current_setting('test.practice')::uuid) is null, 'no role after leaving';
end $$;

-- The lab: created once, opened as a patient (a patient record is made).
select public.admin_create_lab() as lab \gset
select set_config('test.lab', :'lab', false);
do $$ begin
  assert public.admin_create_lab() = current_setting('test.lab')::uuid, 'only one lab';
end $$;
select public.admin_open_practice(:'lab', 'patient');
do $$ begin
  assert (select count(*) from public.patients where user_id = auth.uid()) = 1, 'lab patient record';
  assert public.my_practice_role(current_setting('test.lab')::uuid) is null, 'patient view has no staff role';
end $$;
select public.admin_open_practice(:'lab', 'patient');
do $$ begin assert (select count(*) from public.patients where user_id = auth.uid()) = 1, 'no duplicate patient record'; end $$;

-- Feature switches: lab-only features reach labs only; exceptions win.
select public.admin_set_rollout('messages', 'lab');
do $$ begin
  assert 'messages' = any (public.practice_features(current_setting('test.lab')::uuid)), 'lab gets lab-only feature';
  assert not ('messages' = any (public.practice_features(current_setting('test.practice')::uuid))), 'others do not';
end $$;
select public.admin_set_override(:'practice_id', 'messages', 'on');
do $$ begin assert 'messages' = any (public.practice_features(current_setting('test.practice')::uuid)), 'exception turns it on'; end $$;
select public.admin_set_override(:'practice_id', 'messages', 'default');
select public.admin_set_rollout('messages', 'all');
do $$ begin assert 'messages' = any (public.practice_features(current_setting('test.practice')::uuid)), 'everyone again'; end $$;

-- A normal owner is unaffected and can't see the admin's visits.
select pg_temp.act_as('olivia@test.lb');
do $$ begin
  assert (select count(*) from public.platform_admin_visits) = 0, 'visits are private';
  assert (select count(*) from public.patients) = 1, 'owner still sees their patient';
end $$;

reset role;
select 'admin_test passed' as result;
