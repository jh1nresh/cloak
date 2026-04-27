alter table public.tryons
  alter column result_url drop not null;

alter table public.tryons
  add column if not exists status text not null default 'completed',
  add column if not exists fashn_prediction_id text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tryons_status_check'
  ) then
    alter table public.tryons
      add constraint tryons_status_check
      check (status in ('queued', 'processing', 'finalizing', 'completed', 'failed'));
  end if;
end $$;

create index if not exists tryons_fashn_prediction_id_idx
  on public.tryons (fashn_prediction_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tryons_updated_at on public.tryons;
create trigger set_tryons_updated_at
  before update on public.tryons
  for each row
  execute function public.set_updated_at();

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create or replace function public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
begin
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
  set
    count = case
      when rl.reset_at <= v_now then 1
      else rl.count + 1
    end,
    reset_at = case
      when rl.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
      else rl.reset_at
    end
  returning * into v_row;

  allowed := v_row.count <= p_max_requests;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer)
  end;

  return next;
end;
$$;
