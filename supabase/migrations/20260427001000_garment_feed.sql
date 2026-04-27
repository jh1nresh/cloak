create table if not exists public.garments (
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

drop trigger if exists set_garments_updated_at on public.garments;
create trigger set_garments_updated_at
  before update on public.garments
  for each row
  execute function public.set_updated_at();

alter table public.tryons
  add column if not exists garment_id uuid references public.garments(id);

create index if not exists garments_created_at_idx
  on public.garments (created_at desc);

create index if not exists tryons_garment_id_idx
  on public.tryons (garment_id);
