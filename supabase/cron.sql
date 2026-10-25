-- Nema: scheduled jobs. Run after the first Vercel deploy.
-- Replace the two placeholders:
--   <APP_URL>      e.g. https://nema-protocol.vercel.app
--   <CRON_SECRET>  the same value as the CRON_SECRET env var on Vercel
--
-- Free-plan budget: 1 HTTP call every 10 min = 4,320 Vercel invocations a
-- month (Hobby includes 1,000,000). Housekeeping keeps the 500 MB database
-- and the 2 GB disk flat.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keeper + share-price snapshot + event indexer.
select cron.schedule(
  'nema-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := '<APP_URL>/api/cron/tick',
    headers := jsonb_build_object('authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Daily housekeeping at 03:00 UTC.
select cron.schedule(
  'nema-housekeeping',
  '0 3 * * *',
  $$
  -- pg_cron never prunes its run log.
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  -- Snapshots older than 7 days: keep the first sample of each hour.
  delete from snapshots s
  where s.t < (extract(epoch from now() - interval '7 days') * 1000)::bigint
    and exists (
      select 1 from snapshots e
      where e.vault = s.vault and e.t / 3600000 = s.t / 3600000 and e.t < s.t
    );
  $$
);

-- Check:   select jobname, schedule, active from cron.job;
-- Runs:    select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
