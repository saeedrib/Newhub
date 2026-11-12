-- NEWHUB core schema. Applied to Supabase project gwjajtiagesuzbyxmooq.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  referral_code text not null unique,
  referred_by uuid references public.profiles(id),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points <> 0),
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create table public.tap_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_awarded integer not null check (points_awarded > 0),
  claimed_at timestamptz not null default now()
);
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_requested integer not null check (points_requested > 0),
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index point_ledger_user_created_idx on public.point_ledger(user_id, created_at desc);
create index tap_claims_user_claimed_idx on public.tap_claims(user_id, claimed_at desc);
create index withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id, created_at desc);
alter table public.profiles enable row level security;
alter table public.point_ledger enable row level security;
alter table public.tap_claims enable row level security;
alter table public.withdrawal_requests enable row level security;
grant select on public.profiles to authenticated;
grant select on public.point_ledger to authenticated;
grant select on public.tap_claims to authenticated;
grant select, insert on public.withdrawal_requests to authenticated;
create policy "profiles_read_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "ledger_read_own" on public.point_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy "tap_claims_read_own" on public.tap_claims for select to authenticated using ((select auth.uid()) = user_id);
create policy "withdrawals_read_own" on public.withdrawal_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "withdrawals_insert_own_pending" on public.withdrawal_requests for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending' and reviewed_at is null and admin_note is null);

create or replace function private.handle_new_newhub_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_referrer uuid; v_code text;
begin
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  if new.raw_user_meta_data ? 'referral_code' then
    select id into v_referrer from public.profiles
    where referral_code = upper(new.raw_user_meta_data->>'referral_code') limit 1;
  end if;
  insert into public.profiles (id, display_name, referral_code, referred_by)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), ''), v_code, v_referrer);
  return new;
end;
$$;
revoke all on function private.handle_new_newhub_user() from public, anon, authenticated;
create trigger on_auth_user_created_newhub after insert on auth.users
for each row execute function private.handle_new_newhub_user();
