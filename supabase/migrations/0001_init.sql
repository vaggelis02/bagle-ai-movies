-- BAGLE FLIX — initial schema
--
-- Design decisions worth knowing before reading:
--
-- 1. Series are supported from day one. A `title` is either a film or a series;
--    retrofitting series onto a films-only schema later is painful.
--
-- 2. EVERY playable asset is an `episodes` row — including films. A film gets
--    exactly one episode with `season_id` NULL. This gives playback a single
--    code path instead of two, which matters because playback is the
--    security-critical part of this product.
--
-- 3. The Bunny video id lives in `episode_sources`, a table with RLS enabled
--    and DELIBERATELY NO POLICIES. That makes it unreadable to every browser
--    client, forever, no matter what a future query does. Only the server,
--    using the service-role key, can read it — and only after it has checked
--    entitlement. RLS is row-level, not column-level, so isolating the id in
--    its own table is the only way to make "no video URL is ever public"
--    structurally true rather than a rule someone has to remember.
--
-- 4. No commercial numbers are hardcoded. Plan prices live in Stripe; the
--    creator revenue share and affiliate commission live in `plans` as basis
--    points so they can change without a code deploy.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('viewer', 'creator', 'admin');
create type title_kind as enum ('film', 'series');
create type title_status as enum ('draft', 'pending_review', 'published', 'rejected');
create type asset_status as enum ('awaiting_upload', 'processing', 'ready', 'failed');
create type plan_audience as enum ('viewer', 'creator');
create type commission_status as enum ('pending', 'approved', 'paid', 'void');

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users
-- ---------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          user_role   not null default 'viewer',
  display_name  text,
  avatar_url    text,
  -- Referral code this profile hands out to others.
  affiliate_code text unique,
  -- Whose code this profile signed up with. Set once, at signup.
  referred_by   uuid references profiles (id) on delete set null,
  country       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_referred_by_idx on profiles (referred_by);

-- Every new auth user gets a profile automatically, so application code never
-- has to cope with a logged-in user that has no profile row.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- plans — mirrors the Stripe products, plus our commercial terms
-- ---------------------------------------------------------------------------

create table plans (
  id                 text primary key,          -- e.g. 'viewer_solo'
  audience           plan_audience not null,
  name               text not null,
  stripe_price_id    text unique,
  -- Prices are NOT stored here; Stripe is the source of truth for money.
  max_profiles       int  not null default 1,   -- 1 = solo, >1 = family
  -- Commercial terms as basis points (7000 = 70%), so they can be tuned
  -- without a deploy. Nothing in application code assumes a value.
  creator_share_bps  int  not null default 0 check (creator_share_bps between 0 and 10000),
  affiliate_bps      int  not null default 0 check (affiliate_bps between 0 and 10000),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- titles — a film OR a series
-- ---------------------------------------------------------------------------

create table titles (
  id            uuid primary key default gen_random_uuid(),
  kind          title_kind   not null,
  owner_id      uuid         not null references profiles (id) on delete restrict,
  slug          text         not null unique,
  title         text         not null,
  original_title text,
  synopsis      text,
  genres        text[]       not null default '{}',
  release_year  int,
  poster_url    text,
  backdrop_url  text,
  status        title_status not null default 'draft',
  -- Set by an admin when status moves to 'published'.
  published_at  timestamptz,
  rejection_reason text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create index titles_status_idx     on titles (status);
create index titles_owner_idx      on titles (owner_id);
create index titles_genres_idx     on titles using gin (genres);
create index titles_published_idx  on titles (published_at desc) where status = 'published';

-- ---------------------------------------------------------------------------
-- seasons — series only
-- ---------------------------------------------------------------------------

create table seasons (
  id            uuid primary key default gen_random_uuid(),
  title_id      uuid not null references titles (id) on delete cascade,
  season_number int  not null check (season_number > 0),
  name          text,
  created_at    timestamptz not null default now(),
  unique (title_id, season_number)
);

-- ---------------------------------------------------------------------------
-- episodes — every playable asset, films included
-- ---------------------------------------------------------------------------

create table episodes (
  id             uuid primary key default gen_random_uuid(),
  title_id       uuid not null references titles (id) on delete cascade,
  -- NULL for a film's single episode; required for a series episode.
  season_id      uuid references seasons (id) on delete cascade,
  episode_number int  not null default 1 check (episode_number > 0),
  name           text,
  synopsis       text,
  duration_seconds int,
  thumbnail_url  text,
  status         asset_status not null default 'awaiting_upload',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (title_id, season_id, episode_number)
);

create index episodes_title_idx on episodes (title_id);

-- A film has exactly one episode and no season; a series episode must have one.
create function enforce_episode_shape()
returns trigger
language plpgsql
as $$
declare
  parent_kind title_kind;
begin
  select kind into parent_kind from titles where id = new.title_id;

  if parent_kind = 'film' then
    if new.season_id is not null then
      raise exception 'A film episode must not belong to a season';
    end if;
    if exists (
      select 1 from episodes
      where title_id = new.title_id and id is distinct from new.id
    ) then
      raise exception 'A film can only have one episode';
    end if;
  else
    if new.season_id is null then
      raise exception 'A series episode must belong to a season';
    end if;
  end if;

  return new;
end;
$$;

create trigger episodes_shape
  before insert or update on episodes
  for each row execute function enforce_episode_shape();

-- ---------------------------------------------------------------------------
-- episode_sources — the secret half. RLS on, no policies, ever.
-- ---------------------------------------------------------------------------

create table episode_sources (
  episode_id       uuid primary key references episodes (id) on delete cascade,
  bunny_library_id text,
  bunny_video_id   text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions — mirrored from Stripe. Stripe is the source of truth.
-- ---------------------------------------------------------------------------

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles (id) on delete cascade,
  plan_id                text references plans (id),
  stripe_customer_id     text not null,
  stripe_subscription_id text not null unique,
  -- Stripe's own status string, stored verbatim rather than re-interpreted.
  status                 text not null,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_user_idx on subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- watch_progress — resume playback
-- ---------------------------------------------------------------------------

create table watch_progress (
  user_id          uuid not null references profiles (id) on delete cascade,
  episode_id       uuid not null references episodes (id) on delete cascade,
  position_seconds int  not null default 0 check (position_seconds >= 0),
  completed        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ---------------------------------------------------------------------------
-- view_events — analytics and creator-facing counts
-- ---------------------------------------------------------------------------

create table view_events (
  id          bigserial primary key,
  episode_id  uuid not null references episodes (id) on delete cascade,
  user_id     uuid references profiles (id) on delete set null,
  seconds_watched int not null default 0,
  created_at  timestamptz not null default now()
);

create index view_events_episode_idx on view_events (episode_id, created_at desc);

-- ---------------------------------------------------------------------------
-- affiliates
-- ---------------------------------------------------------------------------

create table affiliate_events (
  id           bigserial primary key,
  code         text not null,
  referrer_id  uuid references profiles (id) on delete set null,
  referred_id  uuid references profiles (id) on delete set null,
  event        text not null,               -- 'signup' | 'subscribed' | ...
  created_at   timestamptz not null default now()
);

create table commissions (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references profiles (id) on delete restrict,
  subscription_id uuid references subscriptions (id) on delete set null,
  -- Minor units (cents) to avoid floating point on money.
  amount_cents int not null,
  currency     text not null default 'eur',
  status       commission_status not null default 'pending',
  created_at   timestamptz not null default now()
);

create index commissions_referrer_idx on commissions (referrer_id, status);

-- ---------------------------------------------------------------------------
-- Helper functions used by the policies below
-- ---------------------------------------------------------------------------

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions
    where user_id = auth.uid()
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- The single definition of "may this user watch this title". Used by the
-- server before it mints a playback token, and by the policies below.
create function can_watch_title(target_title uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from titles
      where id = target_title and owner_id = auth.uid()
    )
    or (
      has_active_subscription()
      and exists (
        select 1 from titles
        where id = target_title and status = 'published'
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles         enable row level security;
alter table plans            enable row level security;
alter table titles           enable row level security;
alter table seasons          enable row level security;
alter table episodes         enable row level security;
alter table episode_sources  enable row level security;
alter table subscriptions    enable row level security;
alter table watch_progress   enable row level security;
alter table view_events      enable row level security;
alter table affiliate_events enable row level security;
alter table commissions      enable row level security;

-- episode_sources gets NO policies on purpose. With RLS enabled and no policy,
-- every anon and authenticated query returns zero rows. Only the service-role
-- key, which bypasses RLS, can read the Bunny video id.

-- profiles
create policy "read own profile"
  on profiles for select
  using (id = auth.uid() or is_admin());

-- Role escalation is blocked by the `profiles_lock_role` trigger below rather
-- than by a WITH CHECK subquery: a policy on `profiles` that itself selects
-- from `profiles` recurses into this same policy and errors at runtime.
create policy "update own profile"
  on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- A user must never be able to promote themselves to creator or admin.
-- Role changes come from the server (service role, which skips triggers'
-- auth.uid() path by having no session user) or from an admin.
create function lock_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Only an administrator can change a profile role';
  end if;
  return new;
end;
$$;

create trigger profiles_lock_role
  before update on profiles
  for each row execute function lock_profile_role();

-- plans — public marketing information
create policy "anyone reads active plans"
  on plans for select
  using (is_active or is_admin());

-- titles — published metadata is public; drafts belong to their owner
create policy "read published or own titles"
  on titles for select
  using (status = 'published' or owner_id = auth.uid() or is_admin());

create policy "creators insert own titles"
  on titles for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('creator', 'admin')
    )
  );

create policy "creators update own unpublished titles"
  on titles for update
  using ((owner_id = auth.uid() and status <> 'published') or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- seasons / episodes follow their parent title's visibility
create policy "read seasons of visible titles"
  on seasons for select
  using (exists (
    select 1 from titles t
    where t.id = title_id
      and (t.status = 'published' or t.owner_id = auth.uid() or is_admin())
  ));

create policy "owners manage seasons"
  on seasons for all
  using (exists (
    select 1 from titles t
    where t.id = title_id and (t.owner_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from titles t
    where t.id = title_id and (t.owner_id = auth.uid() or is_admin())
  ));

create policy "read episodes of visible titles"
  on episodes for select
  using (exists (
    select 1 from titles t
    where t.id = title_id
      and (t.status = 'published' or t.owner_id = auth.uid() or is_admin())
  ));

create policy "owners manage episodes"
  on episodes for all
  using (exists (
    select 1 from titles t
    where t.id = title_id and (t.owner_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from titles t
    where t.id = title_id and (t.owner_id = auth.uid() or is_admin())
  ));

-- subscriptions — readable by their owner, written only by the Stripe webhook
-- (service role). No insert/update policy exists for clients on purpose.
create policy "read own subscriptions"
  on subscriptions for select
  using (user_id = auth.uid() or is_admin());

-- watch_progress — entirely the user's own
create policy "manage own watch progress"
  on watch_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- view_events — creators see events for their own titles; nobody edits them
create policy "read view events for own titles"
  on view_events for select
  using (
    is_admin()
    or exists (
      select 1 from episodes e
      join titles t on t.id = e.title_id
      where e.id = episode_id and t.owner_id = auth.uid()
    )
  );

-- affiliates — a referrer sees their own attribution and earnings
create policy "read own affiliate events"
  on affiliate_events for select
  using (referrer_id = auth.uid() or is_admin());

create policy "read own commissions"
  on commissions for select
  using (referrer_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch        before update on profiles        for each row execute function touch_updated_at();
create trigger titles_touch          before update on titles          for each row execute function touch_updated_at();
create trigger episodes_touch        before update on episodes        for each row execute function touch_updated_at();
create trigger episode_sources_touch before update on episode_sources for each row execute function touch_updated_at();
create trigger subscriptions_touch   before update on subscriptions   for each row execute function touch_updated_at();
create trigger watch_progress_touch  before update on watch_progress  for each row execute function touch_updated_at();
