create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  avatar_url text not null,
  height_cm integer,
  weight_kg integer,
  created_at timestamptz not null default now()
);

create table if not exists garments (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  image_url text not null,
  title text,
  brand text,
  price text,
  domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  garment_id uuid references garments(id) on delete set null,
  garment_url text,
  result_url text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'finalizing', 'completed', 'failed')),
  fashn_prediction_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_garments_updated_at on garments;
create trigger set_garments_updated_at
  before update on garments
  for each row
  execute function set_updated_at();

drop trigger if exists set_tryons_updated_at on tryons;
create trigger set_tryons_updated_at
  before update on tryons
  for each row
  execute function set_updated_at();

create index if not exists garments_created_at_idx
  on garments (created_at desc);

create index if not exists tryons_user_id_idx
  on tryons (user_id);

create index if not exists tryons_garment_id_idx
  on tryons (garment_id);

create index if not exists tryons_fashn_prediction_id_idx
  on tryons (fashn_prediction_id);

create index if not exists rate_limits_reset_at_idx
  on rate_limits (reset_at);
