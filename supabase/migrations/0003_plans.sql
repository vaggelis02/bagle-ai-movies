-- The five launch plans, mirrored from Stripe test mode.
--
-- Prices are NOT here — Stripe owns them, and they are displayed VAT-inclusive
-- because that is what an EU consumer expects to see. What lives here are the
-- commercial terms, as basis points, so they can be changed with one UPDATE
-- instead of a code deploy:
--
--   creator_share_bps  share of a viewer plan's net revenue that funds the
--                      creator payout pool. Zero on creator plans, since a
--                      creator plan is platform income, not shared revenue.
--   affiliate_bps      commission paid to whoever referred the subscriber.
--
-- The 40% creator share below is a WORKING DEFAULT, not a decision. It is the
-- number that lands the platform near a 45% margin once VAT, card fees and
-- bandwidth are taken out. Raising it to 70% drops the margin to roughly 22%.

insert into plans (id, audience, name, stripe_price_id, max_profiles, creator_share_bps, affiliate_bps, is_active) values
  ('viewer_solo',    'viewer',  'BAGLE FLIX — Solo',                   'price_1U4NgtEksr9fnHE43eA4esrr', 1, 4000, 1000, true),
  ('viewer_family',  'viewer',  'BAGLE FLIX — Family',                 'price_1U4NguEksr9fnHE4dpMEAO4O', 5, 4000, 1000, true),
  ('creator_films',  'creator', 'BAGLE FLIX Creator — Films',          'price_1U4NgvEksr9fnHE4x9QUwInb', 1,    0, 1000, true),
  ('creator_series', 'creator', 'BAGLE FLIX Creator — Series',         'price_1U4NgxEksr9fnHE4WFHYkuRb', 1,    0, 1000, true),
  ('creator_all',    'creator', 'BAGLE FLIX Creator — Films + Series', 'price_1U4NgyEksr9fnHE4G3X5YoNo', 1,    0, 1000, true)
on conflict (id) do update set
  name              = excluded.name,
  stripe_price_id   = excluded.stripe_price_id,
  max_profiles      = excluded.max_profiles,
  creator_share_bps = excluded.creator_share_bps,
  affiliate_bps     = excluded.affiliate_bps,
  is_active         = excluded.is_active;
