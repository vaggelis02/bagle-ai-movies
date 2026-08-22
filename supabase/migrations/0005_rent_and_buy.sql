-- Switch the viewer side from "subscribe to everything" to "pay per title".
--
-- Why the change: with a catalogue of one film, a monthly subscription has
-- nothing to justify itself with. Renting works from the first title. The
-- subscription machinery is deliberately left in place and simply unused —
-- when the catalogue is large enough, switching it back on is a data change,
-- not a rewrite.
--
-- Creators now set their own prices. That is the substantive shift: a title
-- carries its price, so the platform no longer decides what anyone's work is
-- worth. Guard rails, not opinions:
--   * a floor, because a fixed card fee of ~$0.30 eats a third of a $1 rental
--   * a ceiling, so a typo cannot list a film at a million dollars
-- Everything between those is the creator's call.

-- ---------------------------------------------------------------------------
-- Prices live on the title
-- ---------------------------------------------------------------------------

create type entitlement_kind as enum ('rental', 'purchase');

alter table titles
  add column currency              text not null default 'usd',
  -- NULL means "not offered": a creator may publish rent-only or buy-only.
  add column rental_price_cents    int,
  add column purchase_price_cents  int,
  -- How long a rental lasts once playback is available to the viewer.
  add column rental_hours          int  not null default 48;

-- The floor is set by economics, not taste: below ~$2 the fixed card fee is a
-- double-digit percentage of the sale. The ceiling only catches typos.
alter table titles
  add constraint rental_price_sane
    check (rental_price_cents is null
           or rental_price_cents between 199 and 99900),
  add constraint purchase_price_sane
    check (purchase_price_cents is null
           or purchase_price_cents between 499 and 99900),
  -- Buying must never cost less than renting, or the storefront looks broken.
  add constraint purchase_at_least_rental
    check (rental_price_cents is null
           or purchase_price_cents is null
           or purchase_price_cents >= rental_price_cents),
  add constraint rental_hours_sane
    check (rental_hours between 1 and 720);

-- A published title has to be buyable somehow.
create or replace function enforce_published_has_price()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published'
     and new.rental_price_cents is null
     and new.purchase_price_cents is null then
    raise exception 'A published title needs a rental price, a purchase price, or both';
  end if;
  return new;
end;
$$;

create trigger titles_published_needs_price
  before insert or update on titles
  for each row execute function enforce_published_has_price();

-- ---------------------------------------------------------------------------
-- entitlements — one row per thing somebody bought
-- ---------------------------------------------------------------------------

create table entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  title_id      uuid not null references titles (id) on delete restrict,
  kind          entitlement_kind not null,
  -- NULL for a purchase: it does not expire.
  expires_at    timestamptz,

  -- What was actually paid, recorded at the time of sale. Prices change; a
  -- receipt must not.
  amount_cents  int  not null check (amount_cents >= 0),
  currency      text not null default 'usd',
  -- The split, frozen at sale time for the same reason.
  creator_cents  int not null default 0 check (creator_cents  >= 0),
  platform_cents int not null default 0 check (platform_cents >= 0),

  stripe_payment_intent_id text unique,
  stripe_session_id        text unique,

  created_at    timestamptz not null default now(),

  constraint rental_has_expiry check (
    (kind = 'rental'   and expires_at is not null) or
    (kind = 'purchase' and expires_at is null)
  )
);

create index entitlements_user_title_idx on entitlements (user_id, title_id);
create index entitlements_title_idx      on entitlements (title_id, created_at desc);

alter table entitlements enable row level security;

-- A buyer sees their own purchases. A creator sees the sales of their own
-- titles — that is the earnings statement. Nobody writes here from a browser:
-- rows are created by the Stripe webhook using the service key.
create policy "read own entitlements"
  on entitlements for select
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from titles t
      where t.id = title_id and t.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- The access rule
-- ---------------------------------------------------------------------------

-- Replaces the subscription-only check. The subscription branch stays: it costs
-- nothing while unused and means turning subscriptions back on later needs no
-- change here.
create or replace function can_watch_title(target_title uuid)
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
    or exists (
      select 1 from entitlements
      where title_id = target_title
        and user_id = auth.uid()
        and (expires_at is null or expires_at > now())
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
-- Commercial terms move to the title's own split
-- ---------------------------------------------------------------------------

-- Viewer plans are retired for now. Not deleted — the rows stay so the option
-- of turning subscriptions back on is a one-line UPDATE.
update plans set is_active = false where audience = 'viewer';

-- What the platform keeps from each sale, in basis points. 2000 = 20%.
alter table plans
  add column if not exists platform_cut_bps int;

insert into plans (id, audience, name, max_profiles, creator_share_bps, affiliate_bps, is_active, platform_cut_bps)
values ('storefront', 'viewer', 'Pay per title', 1, 8000, 1000, true, 2000)
on conflict (id) do update set
  creator_share_bps = excluded.creator_share_bps,
  platform_cut_bps  = excluded.platform_cut_bps,
  is_active         = excluded.is_active;

-- Creator plans get a free trial. Three months, because a creator who has not
-- yet been sent an audience has nothing to pay out of.
alter table plans
  add column if not exists trial_days int not null default 0;

update plans set trial_days = 90 where audience = 'creator';
