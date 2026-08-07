-- Motion try-on: the body capture every look is generated against.
-- `looks` already carries pipeline 'motion' and video_url from
-- 20260531010000_save_to_try_agent.sql, so no change is needed there.

alter table users
  add column if not exists body_video_url text,
  add column if not exists body_video_poster_url text,
  add column if not exists body_video_duration_ms integer,
  add column if not exists body_video_captured_at timestamptz;

create index if not exists looks_provider_job_id_idx
  on looks (provider_job_id)
  where provider_job_id is not null;
