-- Patients see the profiles (names) of the staff of their own practice, so the
-- app can say who their dietitian is and who wrote a message.
create policy profiles_select_patient on public.profiles for select
  using (exists (
    select 1 from public.practice_users pu
      join public.patients p on p.practice_id = pu.practice_id
     where pu.user_id = profiles.id and p.user_id = auth.uid() and p.archived_at is null
  ));
