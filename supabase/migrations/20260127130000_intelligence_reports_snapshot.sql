-- Add cached snapshot payloads for Intelligence Desk
alter table if exists public.intelligence_reports
  add column if not exists insights_json jsonb,
  add column if not exists data_pack text;
