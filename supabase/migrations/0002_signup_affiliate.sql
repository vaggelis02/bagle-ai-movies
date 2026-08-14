-- Affiliate attribution has to happen at the moment of signup. If a user is
-- created without capturing who referred them, that link is gone for good —
-- there is no way to reconstruct it later. So it belongs in the same trigger
-- that creates the profile, not in a later "set up affiliates" phase.
--
-- Also gives every profile its own referral code up front, so any user can
-- start referring without an extra provisioning step.

create or replace function generate_affiliate_code()
returns text
language plpgsql
as $$
declare
  -- No 0/O/1/I: these codes get read aloud and typed by hand.
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where affiliate_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_code text;
  referrer uuid;
begin
  incoming_code := upper(nullif(trim(new.raw_user_meta_data ->> 'referral_code'), ''));

  if incoming_code is not null then
    select id into referrer from public.profiles where affiliate_code = incoming_code;
  end if;

  insert into public.profiles (id, display_name, affiliate_code, referred_by)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    generate_affiliate_code(),
    referrer
  );

  -- Record the attribution as an event too, so the commission ledger has a
  -- dated trail rather than only the current state of the profile row.
  if referrer is not null then
    insert into public.affiliate_events (code, referrer_id, referred_id, event)
    values (incoming_code, referrer, new.id, 'signup');
  end if;

  return new;
end;
$$;

-- Backfill codes for any profile created before this migration.
update profiles set affiliate_code = generate_affiliate_code() where affiliate_code is null;
