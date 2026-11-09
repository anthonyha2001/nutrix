-- The meal plan PDF sent on WhatsApp is logged like the other messages.
alter table public.whatsapp_log drop constraint whatsapp_log_kind_check;
alter table public.whatsapp_log add constraint whatsapp_log_kind_check
  check (kind in ('appointment_reminder', 'appointment_confirmed', 'payment_received', 'package_expiring', 'plan_ready', 'app_invite', 'intake_form', 'plan_pdf'));
