-- NEWHUB secure rewards API foundation
create table if not exists public.app_settings (
  setting_key text primary key, setting_value jsonb not null, updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings(setting_key,setting_value) values
 ('tap_points','2'::jsonb),('tap_cooldown_seconds','10'::jsonb),('tap_daily_limit','100'::jsonb),
 ('referral_signup_points','15'::jsonb),('referral_milestone_count','50'::jsonb),('referral_milestone_points','1000'::jsonb),('withdrawal_min_points','4000'::jsonb)
on conflict(setting_key) do nothing;
create policy "settings_read_authenticated" on public.app_settings for select to authenticated using (true);
grant select on public.app_settings to authenticated;

create or replace function public.newhub_claim_tap(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_points integer; v_cooldown integer; v_limit integer; v_last timestamptz; v_today integer;
begin
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Account profile not found'; end if;
 select (setting_value #>> '{}')::integer into v_points from public.app_settings where setting_key='tap_points';
 select (setting_value #>> '{}')::integer into v_cooldown from public.app_settings where setting_key='tap_cooldown_seconds';
 select (setting_value #>> '{}')::integer into v_limit from public.app_settings where setting_key='tap_daily_limit';
 v_points:=coalesce(v_points,2); v_cooldown:=coalesce(v_cooldown,10); v_limit:=coalesce(v_limit,100);
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select max(claimed_at) into v_last from public.tap_claims where user_id=p_user_id;
 if v_last is not null and v_last>now()-make_interval(secs=>v_cooldown) then raise exception 'Please wait before tapping again'; end if;
 select count(*)::integer into v_today from public.tap_claims where user_id=p_user_id and claimed_at>=date_trunc('day',now());
 if v_today>=v_limit then raise exception 'You have reached today''s tap limit'; end if;
 insert into public.tap_claims(user_id,points_awarded) values(p_user_id,v_points);
 insert into public.point_ledger(user_id,points,reason) values(p_user_id,v_points,'tap_reward');
 return jsonb_build_object('points_awarded',v_points,'today_taps',v_today+1,'daily_limit',v_limit);
end; $$;
revoke all on function public.newhub_claim_tap(uuid) from public,anon,authenticated;
grant execute on function public.newhub_claim_tap(uuid) to service_role;

create or replace function public.newhub_request_withdrawal(p_user_id uuid,p_points integer,p_details jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_min integer; v_id uuid;
begin
 if p_points is null or p_points<=0 then raise exception 'Enter a valid points amount'; end if;
 select coalesce(sum(points),0)::integer into v_balance from public.point_ledger where user_id=p_user_id;
 select (setting_value #>> '{}')::integer into v_min from public.app_settings where setting_key='withdrawal_min_points';
 if p_points<coalesce(v_min,4000) then raise exception 'Minimum withdrawal is 4,000 points'; end if;
 if p_points>v_balance then raise exception 'Insufficient points balance'; end if;
 insert into public.withdrawal_requests(user_id,points_requested,payout_details) values(p_user_id,p_points,coalesce(p_details,'{}'::jsonb)) returning id into v_id;
 insert into public.point_ledger(user_id,points,reason,reference_id) values(p_user_id,-p_points,'withdrawal_reserved',v_id);
 return v_id;
end; $$;
revoke all on function public.newhub_request_withdrawal(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.newhub_request_withdrawal(uuid,integer,jsonb) to service_role;

create or replace function public.newhub_admin_set_withdrawal(p_withdrawal_id uuid,p_status text,p_note text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_row public.withdrawal_requests%rowtype;
begin
 if p_status not in ('approved','rejected','paid') then raise exception 'Invalid status'; end if;
 select * into v_row from public.withdrawal_requests where id=p_withdrawal_id for update;
 if not found then raise exception 'Request not found'; end if;
 if v_row.status<>'pending' then raise exception 'Request has already been reviewed'; end if;
 update public.withdrawal_requests set status=p_status,admin_note=p_note,reviewed_at=now() where id=p_withdrawal_id;
 if p_status='rejected' then insert into public.point_ledger(user_id,points,reason,reference_id) values(v_row.user_id,v_row.points_requested,'withdrawal_refund',p_withdrawal_id); end if;
 return true;
end; $$;
revoke all on function public.newhub_admin_set_withdrawal(uuid,text,text) from public,anon,authenticated;
grant execute on function public.newhub_admin_set_withdrawal(uuid,text,text) to service_role;
