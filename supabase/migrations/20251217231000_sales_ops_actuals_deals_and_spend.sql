-- Sales Ops actuals: deals won + sqft won + channel spend

alter table public.project_actuals
  add column if not exists deals_won int not null default 0,
  add column if not exists sqft_won numeric not null default 0,
  add column if not exists spend_digital numeric not null default 0,
  add column if not exists spend_inbound numeric not null default 0,
  add column if not exists spend_activations numeric not null default 0;

