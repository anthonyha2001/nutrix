-- Clinical tools: target weight, lab results and the online intake form.

-- ---------------------------------------------------------------------------
-- Target weight (the overview projects when it will be reached)
-- ---------------------------------------------------------------------------

alter table public.patient_health
  add column target_weight_kg numeric(5, 1) check (target_weight_kg between 20 and 400);
