-- Patients can read their own practice (name and timezone for the patient app).
create policy practices_select_patient on public.practices for select
  using (exists (select 1 from public.patients p where p.practice_id = practices.id and p.user_id = auth.uid() and p.archived_at is null));
