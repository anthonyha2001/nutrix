-- Importing lab results and body composition from files.
--
-- Files are read on the server and every value is reviewed and approved by
-- the dietitian before it is saved. Imported lab results keep where they came
-- from (the file and the exact line), so any number can be traced back.

alter table public.lab_results
  add column source      text not null default 'manual' check (source in ('manual', 'import', 'ai_import')),
  add column source_file text check (char_length(source_file) <= 200),
  add column source_line text check (char_length(source_line) <= 300);

-- AI reading of photos and scanned documents (files without text). Off until
-- the platform admin switches it on; it also needs ANTHROPIC_API_KEY on the server.
insert into public.features (key, name, description, rollout) values
  ('ai_document_import', 'AI reading of photos and scans',
   'Lab reports and body composition printouts without text (photos, scans) are read by AI. Needs ANTHROPIC_API_KEY. About 0.2 US cents a document. Every value is still reviewed before saving.',
   'off')
on conflict (key) do nothing;
