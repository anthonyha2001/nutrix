-- Phase 2: appointments, packages, invoices, payments, messages, diary.
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
  ('dina@test.lb', '{"full_name":"Dina Dietitian"}'),
  ('rami@test.lb', '{"full_name":"Rami Dietitian"}'),
  ('asma@test.lb', '{"full_name":"Asma Assistant"}');

select pg_temp.act_as('olivia@test.lb');
select public.create_practice('Beirut Nutrition Clinic') as practice_id \gset
update public.practices set lbp_rate = 89500 where id = :'practice_id';
insert into public.invites (practice_id, email, role, invited_by)
select :'practice_id', e, r::public.practice_role, auth.uid()
from (values ('dina@test.lb', 'dietitian'), ('rami@test.lb', 'dietitian'), ('asma@test.lb', 'assistant')) v(e, r);
select pg_temp.act_as('dina@test.lb'); select public.claim_mine();
select pg_temp.act_as('rami@test.lb'); select public.claim_mine();
select pg_temp.act_as('asma@test.lb'); select public.claim_mine();

-- Catalogue (owner).
select pg_temp.act_as('olivia@test.lb');
insert into public.services (practice_id, name, duration_min, price_usd) values (:'practice_id', 'Follow-up', 30, 40) returning id as follow_up \gset
insert into public.package_types (practice_id, name, consultations, price_usd, valid_days)
values (:'practice_id', '4 visits', 4, 140, 60) returning id as pack \gset

-- Dina's patient Lina.
select pg_temp.act_as('dina@test.lb');
insert into public.patients (practice_id, dietitian_id, full_name, email) values (:'practice_id', auth.uid(), 'Lina Patient', 'lina@test.lb')
returning id as lina \gset
select set_config('test.lina', :'lina', false);
select set_config('test.svc', :'follow_up', false);

-- Dina books; a second booking overlapping the first is refused.
select date_trunc('hour', now()) - interval '3 days' as t1 \gset
select set_config('test.t1', :'t1', false);
select public.book_appointment(:'lina', :'t1', null, :'follow_up') as appt1 \gset
do $$ begin
  assert (select ends_at - starts_at from public.appointments limit 1) = interval '30 minutes', 'duration from service';
  begin
    perform public.book_appointment(current_setting('test.lina')::uuid, current_setting('test.t1')::timestamptz + interval '15 minutes', 30);
    assert false, 'double booking should fail';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Rami can't book Dina's patient.
select pg_temp.act_as('rami@test.lb');
do $$ begin
  begin
    perform public.book_appointment(current_setting('test.lina')::uuid, now() + interval '1 day', 30);
    assert false, 'other dietitian cannot book';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.appointments) = 0, 'other dietitian sees no appointments';
end $$;

-- Assistant sells a package and sees money; dietitians don't.
select pg_temp.act_as('asma@test.lb');
select public.sell_package(:'lina', :'pack', current_date - 7) as pack_invoice \gset
do $$ begin
  assert (select amount_usd from public.invoices) = 140, 'package invoice';
  assert (select number from public.invoices) = 1, 'first invoice number';
  assert (select expires_on - starts_on from public.patient_packages) = 59, '60 days valid';
end $$;
-- LBP cash: 4,475,000 LBP at 89,500 = 50 USD.
select public.record_payment(:'pack_invoice', 'cash_lbp', null, 4475000) as pay1 \gset
do $$ begin
  assert (select amount_usd from public.payments) = 50, 'LBP converted at the practice rate';
  assert (select due_usd from public.invoice_balances) = 90, '90 still due';
  begin
    perform public.record_payment((select id from public.invoices limit 1), 'cash_usd', 100);
    assert false, 'overpayment should fail';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.void_invoice((select id from public.invoices limit 1));
    assert false, 'void with payments should fail';
  exception when invalid_parameter_value then null;
  end;
end $$;

select pg_temp.act_as('dina@test.lb');
do $$ begin
  assert (select count(*) from public.invoices) = 0, 'dietitian sees no invoices';
  assert (select count(*) from public.payments) = 0, 'dietitian sees no payments';
  assert (select count(*) from public.patient_packages) = 1, 'dietitian sees the package (consultations left)';
end $$;

-- Completing uses the package; no invoice.
select public.complete_appointment(:'appt1') as inv \gset
do $$ begin
  assert (select status from public.appointments limit 1) = 'completed', 'completed';
  assert (select remaining from public.package_usage) = 3, '3 consultations left';
end $$;
select pg_temp.act_as('asma@test.lb');
do $$ begin assert (select count(*) from public.invoices) = 1, 'no extra invoice when a package covers it'; end $$;

-- Without a package: the service is billed.
reset role;
update public.patient_packages set cancelled_at = now();
select pg_temp.act_as('asma@test.lb');
select public.book_appointment(:'lina', date_trunc('hour', now()) - interval '2 days', null, :'follow_up') as appt2 \gset
select public.complete_appointment(:'appt2') as inv2 \gset
do $$ begin
  assert (select amount_usd from public.invoices where number = 2) = 40, 'service billed';
  assert (select appointment_id from public.invoices where number = 2) is not null, 'linked to the appointment';
end $$;
select public.void_invoice(:'inv2', 'Courtesy');
do $$ begin assert (select due_usd from public.invoice_balances ib join public.invoices i on i.id = ib.invoice_id where i.number = 2) = 0, 'voided owes nothing'; end $$;

-- No-show.
select public.book_appointment(:'lina', date_trunc('hour', now()) - interval '1 day', null, :'follow_up') as appt3 \gset
-- A future appointment can't be marked yet.
select public.book_appointment(:'lina', now() + interval '2 days', null, :'follow_up') as future \gset
select set_config('test.future', :'future', false);
do $$ begin
  begin
    perform public.complete_appointment(current_setting('test.future')::uuid);
    assert false, 'future attendance should fail';
  exception when invalid_parameter_value then null;
  end;
end $$;
select public.complete_appointment(:'appt3', false);
do $$ begin assert (select count(*) from public.appointments where status = 'no_show') = 1, 'no-show recorded'; end $$;

-- Patient: requests, messages, diary, water, check-in, weight.
reset role;
insert into auth.users (email, raw_user_meta_data) values ('lina@test.lb', '{"full_name":"Lina Patient"}');
select pg_temp.act_as('lina@test.lb');
select public.request_appointment(now() + interval '3 days', 'Evening if possible') as req \gset
do $$ begin
  assert (select status from public.appointments where patient_note is not null) = 'requested', 'request created';
  assert (select count(*) from public.invoices) = 0, 'patient sees no invoices';
end $$;
select public.cancel_appointment(:'req');

insert into public.messages (patient_id, sender_id, from_patient, body) values (:'lina', auth.uid(), true, 'Can I swap rice for bulgur?');
do $$ begin
  begin
    insert into public.messages (patient_id, sender_id, from_patient, body) values (current_setting('test.lina')::uuid, auth.uid(), false, 'Pretending to be staff');
    assert false, 'patient cannot send as staff';
  exception when insufficient_privilege then null;
  end;
end $$;

select public.log_food(current_date, 'lunch', (select id from public.foods where name = 'Tabbouleh'), 132) as entry \gset
do $$ begin
  assert (select kcal from public.diary_entries) = round((select kcal from public.foods where name = 'Tabbouleh') * 1.32, 1), 'diary kcal from the database';
end $$;
select public.add_water(current_date, 250);
select public.add_water(current_date, 500);
do $$ begin assert (select water_ml from public.daily_checkins) = 750, 'water adds up'; end $$;
select public.save_checkin(current_date, 4, 3, 2, 7.5, 4, 'Good day');
do $$ begin
  assert (select water_ml from public.daily_checkins) = 750, 'check-in keeps water';
  assert (select mood from public.daily_checkins) = 4, 'check-in saved';
end $$;
insert into public.measurements (patient_id, weight_kg, source, recorded_by) values (:'lina', 71.8, 'patient', auth.uid());
do $$ begin
  begin
    insert into public.measurements (patient_id, weight_kg, source, recorded_by) values (current_setting('test.lina')::uuid, 60, 'inbody', auth.uid());
    assert false, 'patient cannot fake device readings';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Dina reads it all and replies; the assistant sees none of it.
select pg_temp.act_as('dina@test.lb');
do $$ begin
  assert (select count(*) from public.diary_entries) = 1, 'dietitian sees diary';
  assert (select count(*) from public.daily_checkins) = 1, 'dietitian sees check-ins';
  assert (select count(*) from public.messages where read_at is null) = 1, 'unread message';
end $$;
select public.mark_thread_read(:'lina');
insert into public.messages (patient_id, sender_id, from_patient, body) values (:'lina', auth.uid(), false, 'Yes, same amount.');
do $$ begin assert (select count(*) from public.messages where from_patient and read_at is not null) = 1, 'marked read'; end $$;

select pg_temp.act_as('asma@test.lb');
do $$ begin
  assert (select count(*) from public.messages) = 0, 'assistant: no messages';
  assert (select count(*) from public.diary_entries) = 0, 'assistant: no diary';
  assert (select count(*) from public.appointments) = 5, 'assistant: all appointments';
end $$;

select pg_temp.act_as('rami@test.lb');
do $$ begin
  assert (select count(*) from public.messages) = 0, 'other dietitian: no messages';
  assert (select count(*) from public.diary_entries) = 0, 'other dietitian: no diary';
end $$;

reset role;
select 'phase2_test passed' as result;
