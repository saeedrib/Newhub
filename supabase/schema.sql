-- NEWHUB initial schema. Review and apply only to a NEW, dedicated Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  referral_code text unique not null default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  referred_by uuid references public.profiles(id),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('tap','referral_signup','referral_qualified','admin_adjustment','withdrawal')),
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.tap_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points >= 4000),
  payout_method text not null,
  payout_details jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists point_ledger_user_created_idx on public.point_ledger(user_id, created_at desc);
create index if not exists tap_claims_user_created_idx on public.tap_claims(user_id, claimed_at desc);
create index if not exists withdrawals_user_created_idx on public.withdrawal_requests(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.point_ledger enable row level security;
alter table public.tap_claims enable row level security;
alter table public.withdrawal_requests enable row level security;

create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own basic profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id and role = 'user' and referred_by is not distinct from (select referred_by from public.profiles p where p.id = (select auth.uid())));
create policy "Users can read own ledger" on public.point_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read own taps" on public.tap_claims for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read own withdrawals" on public.withdrawal_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can request withdrawals" on public.withdrawal_requests for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');

-- No client-side INSERT/UPDATE policies on points or tap claims.
-- Awards and tap limits must be performed by trusted server-side functions only.
-- Admin role must be assigned manually by the project owner using the Supabase SQL editor.
