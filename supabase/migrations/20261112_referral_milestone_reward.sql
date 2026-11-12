-- NEWHUB: 35 registered referrals unlock a one-time 20,000-point reward.
-- Applied to project gwjajtiagesuzbyxmooq on 2026-11-12.
create table if not exists public.referral_milestones (
  referrer_id uuid primary key references public.profiles(id) on delete cascade,
  referral_count integer not null,
  points_awarded integer not null,
  qualified_at timestamptz not null default now()
);
alter table public.referral_milestones enable row level security;

create or replace function private.award_newhub_referral_milestone()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  v_goal integer;
  v_reward integer;
  v_inserted uuid;
begin
  if new.referred_by is null or new.referred_by = new.id then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.referred_by::text, 35));
  select coalesce((setting_value #>> '{}')::integer,35) into v_goal
    from public.app_settings where setting_key='referral_milestone_count';
  select coalesce((setting_value #>> '{}')::integer,20000) into v_reward
    from public.app_settings where setting_key='referral_milestone_points';
  select count(*)::integer into v_count from public.profiles where referred_by=new.referred_by;
  if v_count >= v_goal then
    insert into public.referral_milestones(referrer_id,referral_count,points_awarded)
    values(new.referred_by,v_count,v_reward)
    on conflict (referrer_id) do nothing returning referrer_id into v_inserted;
    if v_inserted is not null then
      insert into public.point_ledger(user_id,points,reason,reference_id)
      values(new.referred_by,v_reward,'referral_qualified',new.id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_newhub_referral_milestone on public.profiles;
create trigger on_newhub_referral_milestone after insert on public.profiles
for each row execute function private.award_newhub_referral_milestone();
