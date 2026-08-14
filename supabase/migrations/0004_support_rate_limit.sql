-- The support chat calls a paid API on every message, from a public endpoint.
-- Without a limit, one person with a script can spend the whole month's
-- budget in minutes — so the limit protects the bill, not the server.
--
-- Counted in Postgres rather than in memory because the app runs as many
-- short-lived instances; an in-process counter would reset constantly and
-- never actually limit anything.

create table support_usage (
  -- Either 'user:<uuid>' or 'ip:<address>' — signed-in people are counted per
  -- account, everyone else per address.
  subject      text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (subject, window_start)
);

-- Nobody but the server may read or write this. RLS on, no policies.
alter table support_usage enable row level security;

/**
 * Records one message and reports whether the caller is over the limit.
 * Returns the number of messages used in the current hour.
 */
create function bump_support_usage(subject_key text, window_minutes int default 60)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := date_trunc('hour', now());
  used int;
begin
  insert into support_usage (subject, window_start, count)
  values (subject_key, bucket, 1)
  on conflict (subject, window_start)
    do update set count = support_usage.count + 1
  returning count into used;

  -- Old buckets are dead weight; clear them opportunistically rather than
  -- running a scheduled job for a table this small.
  delete from support_usage
  where window_start < now() - (window_minutes || ' minutes')::interval - interval '1 hour';

  return used;
end;
$$;
