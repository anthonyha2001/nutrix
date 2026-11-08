-- Access-control tests for the foundation schema. Run via run_tests.sh.
-- Each block acts as one user (set role + JWT sub) and asserts what they can see and do.
\set ON_ERROR_STOP on

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('olivia@test.lb', '{"full_name":"Olivia Owner"}'),
  ('dina@test.lb',   '{"full_name":"Dina Dietitian"}'),
  ('rami@test.lb',   '{"full_name":"Rami Dietitian"}'),
  ('asma@test.lb',   '{"full_name":"Asma Assistant"}'),
  ('omar@test.lb',   '{"full_name":"Omar Outsider"}');

-- Olivia opens a practice and invites her team (Dina and Rami already have accounts).
select pg_temp.act_as('olivia@test.lb');
select public.create_practice('Beirut Nutrition Clinic') as practice_id \gset
do $$ begin
  assert (select slug from public.practices) = 'beirut-nutrition-clinic', 'slug generated';
  assert public.my_practice_role((select id from public.practices)) = 'owner', 'creator is owner';
end $$;
insert into public.invites (practice_id, email, role, invited_by)
select :'practice_id', e, r::public.practice_role, auth.uid()
from (values ('dina@test.lb', 'dietitian'), ('rami@test.lb', 'dietitian'), ('asma@test.lb', 'assistant')) v(e, r);

select pg_temp.act_as('dina@test.lb');  select public.claim_mine();
select pg_temp.act_as('rami@test.lb');  select public.claim_mine();
select pg_temp.act_as('asma@test.lb');  select public.claim_mine();

-- Two patients: one each for Dina and Rami. Lina has no login yet.
select pg_temp.act_as('olivia@test.lb');
insert into public.patients (practice_id, dietitian_id, full_name, email)
values
  (:'practice_id', (select id from public.profiles where email = 'dina@test.lb'), 'Lina Patient', 'lina@test.lb'),
  (:'practice_id', (select id from public.profiles where email = 'rami@test.lb'), 'Karim Patient', null);
do $$ begin
  assert (select count(*) from public.patients) = 2, 'owner sees every patient';
  assert public.can_see_clinical((select id from public.patients where full_name = 'Karim Patient')), 'owner has clinical access';
end $$;

-- Dina sees only her patient, and can't take Rami's.
select pg_temp.act_as('dina@test.lb');
do $$ begin
  assert (select count(*) from public.patients) = 1, 'dietitian sees only assigned patients';
  assert (select full_name from public.patients) = 'Lina Patient', 'the right one';
  assert public.can_see_clinical((select id from public.patients)), 'clinical access to own patient';
end $$;
update public.patients set dietitian_id = auth.uid() where full_name = 'Karim Patient';
reset role;
do $$ begin
  assert (select p.email from public.patients pa join public.profiles p on p.id = pa.dietitian_id where pa.full_name = 'Karim Patient') = 'rami@test.lb',
    'dietitian cannot claim another dietitian''s patient';
end $$;

-- Assistant: contact details yes, clinical access no.
reset role;
select set_config('test.omar', (select id::text from public.profiles where email = 'omar@test.lb'), false);
select pg_temp.act_as('asma@test.lb');
do $$ begin
  assert (select count(*) from public.patients) = 2, 'assistant sees patient contacts';
  assert not public.can_see_clinical((select id from public.patients where full_name = 'Lina Patient')), 'assistant has no clinical access';
end $$;
-- Assistants can't assign a patient to someone who isn't a dietitian here.
do $$ begin
  begin
    update public.patients set dietitian_id = current_setting('test.omar')::uuid where full_name = 'Lina Patient';
    assert false, 'assigning to an outsider should fail';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- Outsider sees nothing.
select pg_temp.act_as('omar@test.lb');
do $$ begin
  assert (select count(*) from public.practices) = 0, 'outsider sees no practice';
  assert (select count(*) from public.patients) = 0, 'outsider sees no patients';
  assert (select count(*) from public.practice_users) = 0, 'outsider sees no team';
end $$;

-- Lina signs up with the email on her record: linked, sees only herself.
reset role;
insert into auth.users (email, raw_user_meta_data) values ('lina@test.lb', '{"full_name":"Lina Patient"}');
select pg_temp.act_as('lina@test.lb');
do $$ begin
  assert (select count(*) from public.patients) = 1, 'patient sees own record only';
  assert public.is_patient_self((select id from public.patients)), 'linked to her login';
  assert not public.can_see_clinical((select id from public.patients)), 'patients are not clinicians';
  assert (select count(*) from public.practice_users) = 0, 'patient is not staff';
end $$;

-- Only the owner manages the team.
select pg_temp.act_as('dina@test.lb');
delete from public.practice_users where user_id = (select id from public.profiles where email = 'asma@test.lb');
reset role;
do $$ begin
  assert (select count(*) from public.practice_users) = 4, 'dietitian cannot remove team members';
end $$;

reset role;
select 'rls_test passed' as result;
