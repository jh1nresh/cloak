alter table garments
  add column if not exists image_classification text not null default 'unknown'
    check (image_classification in ('on_model', 'flat_product', 'editorial', 'logo', 'unknown')),
  add column if not exists recommended_pipeline text not null default 'tryon'
    check (recommended_pipeline in ('model_swap', 'tryon'));

alter table tryons
  add column if not exists pipeline text not null default 'tryon'
    check (pipeline in ('model_swap', 'tryon')),
  add column if not exists saved_item_id uuid,
  add column if not exists source_image_url text;

create table if not exists saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  source_type text not null
    check (source_type in ('url', 'image', 'screenshot', 'text')),
  source_url text,
  source_domain text,
  title text,
  brand text,
  price text,
  status text not null default 'saved'
    check (status in ('saved', 'analyzing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_images (
  id uuid primary key default gen_random_uuid(),
  saved_item_id uuid not null references saved_items(id) on delete cascade,
  image_url text not null,
  width integer,
  height integer,
  rank integer not null,
  classification text not null
    check (classification in ('on_model', 'flat_product', 'editorial', 'logo', 'unknown')),
  selected_for_generation boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  saved_item_id uuid references saved_items(id) on delete set null,
  source_image_id uuid references item_images(id) on delete set null,
  tryon_id uuid references tryons(id) on delete set null,
  pipeline text not null check (pipeline in ('model_swap', 'tryon', 'motion')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'finalizing', 'completed', 'failed')),
  provider text,
  provider_job_id text,
  result_url text,
  video_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists taste_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  saved_item_id uuid references saved_items(id) on delete set null,
  look_id uuid references looks(id) on delete set null,
  garment_id uuid references garments(id) on delete set null,
  tryon_id uuid references tryons(id) on delete set null,
  event_type text not null
    check (event_type in ('save', 'skip', 'buy_click', 'share', 'regenerate', 'compare_original')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists taste_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  preferred_brands text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  preferred_colors text[] not null default '{}',
  preferred_silhouettes text[] not null default '{}',
  preferred_price_bands text[] not null default '{}',
  negative_brands text[] not null default '{}',
  negative_categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

drop trigger if exists set_saved_items_updated_at on saved_items;
create trigger set_saved_items_updated_at
  before update on saved_items
  for each row
  execute function set_updated_at();

drop trigger if exists set_looks_updated_at on looks;
create trigger set_looks_updated_at
  before update on looks
  for each row
  execute function set_updated_at();

create index if not exists garments_recommended_pipeline_idx
  on garments (recommended_pipeline);

create index if not exists saved_items_user_id_created_at_idx
  on saved_items (user_id, created_at desc);

create index if not exists item_images_saved_item_id_rank_idx
  on item_images (saved_item_id, rank);

create index if not exists looks_user_id_created_at_idx
  on looks (user_id, created_at desc);

create index if not exists looks_tryon_id_idx
  on looks (tryon_id);

create index if not exists taste_events_user_id_created_at_idx
  on taste_events (user_id, created_at desc);
