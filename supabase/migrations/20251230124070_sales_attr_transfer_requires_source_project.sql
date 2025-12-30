-- Enforce: transfers must have a source project (idempotent)

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'sales_attribution_events'
      and c.conname = 'sales_attr_transfer_requires_source_project'
  ) then
    alter table public.sales_attribution_events
      add constraint sales_attr_transfer_requires_source_project
      check (bucket <> 'transfer' or source_project_id is not null);
  end if;
end $$;


