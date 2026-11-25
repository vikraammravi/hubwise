-- Per-business AI scan allowance and platform usage reporting.
--
-- 1. AI scanning becomes a per-business setting (businesses.settings->'ai_scan' =
--    {"enabled": bool, "monthly_limit": int}). Absent means enabled with 100 scans a month,
--    which is what Ahaa had before. Previously the only limit was one 100-scans-a-month ceiling
--    shared by every business, so one business could exhaust everyone's scans. Each business now
--    also has its own allowance. The platform-wide ceiling stays at 100 a month because the Azure
--    resource is on the free F0 tier (about 500 pages a month across staging and production, up to
--    2 pages a scan); raise it only after moving Azure to a paid tier. 10 per user a day is unchanged.
-- 2. platform_business_usage(): counts and dates only (never amounts or records) per business,
--    for the superadmin console: AI scan usage, feature usage and setup progress.
-- Release order: apply before deploying app code that calls these functions. Existing app code
-- keeps working (same reserve function signature).
begin;

create or replace function public.business_ai_scan_enabled(p_settings jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p_settings->'ai_scan'->>'enabled','true') <> 'false'
$$;

create or replace function public.business_ai_scan_limit(p_settings jsonb) returns integer
language sql immutable set search_path='' as $$
 select case when coalesce(p_settings->'ai_scan'->>'monthly_limit','') ~ '^[0-9]{1,5}$'
             then (p_settings->'ai_scan'->>'monthly_limit')::integer else 100 end
$$;
revoke all on function public.business_ai_scan_enabled(jsonb) from public, anon, authenticated;
revoke all on function public.business_ai_scan_limit(jsonb) from public, anon, authenticated;

create or replace function public.reserve_receipt_scan_for_business(p_business_id uuid, p_receipt_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare month_key text:=to_char(now() at time zone 'UTC','YYYY-MM');
 user_day_key text:=p_user_id::text||':'||to_char(now() at time zone 'America/Toronto','YYYY-MM-DD');
 member_role text; branch uuid; business_settings jsonb;
begin
 perform pg_advisory_xact_lock(730030003);
 select m.role::text,m.location_id,b.settings into member_role,branch,business_settings from public.business_memberships m
 join public.businesses b on b.id=m.business_id join public.profiles p on p.id=m.user_id
 where m.business_id=p_business_id and m.user_id=p_user_id and m.status::text='active' and p.status::text='active'
 and b.status='active' and b.isolation_ready;
 if member_role is null or member_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER') then return false; end if;
 if not public.business_ai_scan_enabled(business_settings) then return false; end if;
 if not exists(select 1 from public.purchase_receipts r where r.id=p_receipt_id and r.business_id=p_business_id and r.deleted_at is null
 and ((member_role='CENTRAL_ADMIN' and r.location_id is null) or (member_role='BRANCH_MANAGER' and branch is not null and r.location_id=branch))) then return false; end if;
 -- The business's own monthly allowance, then a platform-wide safety ceiling; both include archived receipts.
 if (select coalesce(sum((scan_usage->>month_key)::integer),0) from public.purchase_receipts where business_id=p_business_id)>=public.business_ai_scan_limit(business_settings)
 or (select coalesce(sum((scan_usage->>month_key)::integer),0) from public.purchase_receipts)>=100
 or (select coalesce(sum((scan_usage->>user_day_key)::integer),0) from public.purchase_receipts)>=10
 or exists(select 1 from public.purchase_receipts where scan_started_at>now()-interval '5 seconds')
 or exists(select 1 from public.purchase_receipts where id=p_receipt_id and scan_status='RUNNING' and scan_started_at>now()-interval '1 hour') then return false; end if;
 update public.purchase_receipts set
 scan_usage=jsonb_set(jsonb_set(scan_usage,array[month_key],to_jsonb(coalesce((scan_usage->>month_key)::integer,0)+1)),array[user_day_key],to_jsonb(coalesce((scan_usage->>user_day_key)::integer,0)+1)),
 scan_status='RUNNING',scan_started_at=now(),operation_url=null where id=p_receipt_id and business_id=p_business_id and deleted_at is null;
 return found;
end; $$;

create or replace function public.platform_set_business_ai_scan(p_business_id uuid, p_enabled boolean, p_monthly_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare setting jsonb;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if p_enabled is null or p_monthly_limit is null or p_monthly_limit < 0 or p_monthly_limit > 10000 then
   raise exception 'Choose a monthly allowance between 0 and 10000' using errcode='22023';
 end if;
 setting := jsonb_build_object('enabled',p_enabled,'monthly_limit',p_monthly_limit);
 -- The default (on, 100) is stored as no setting, so an empty business in setup stays deletable.
 update public.businesses set settings = case when p_enabled and p_monthly_limit = 100 then coalesce(settings,'{}'::jsonb) - 'ai_scan'
                                         else jsonb_set(coalesce(settings,'{}'::jsonb),'{ai_scan}',setting,true) end,
        updated_at=clock_timestamp()
  where id=p_business_id;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 return setting;
end; $$;
revoke all on function public.platform_set_business_ai_scan(uuid,boolean,integer) from public, anon;
grant execute on function public.platform_set_business_ai_scan(uuid,boolean,integer) to authenticated;

create or replace function public.platform_business_usage() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 month_key text := to_char(now() at time zone 'UTC','YYYY-MM');
 month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
 since30 timestamptz := now() - interval '30 days';
 since7 timestamptz := now() - interval '7 days';
 months text[] := array(select to_char(date_trunc('month', now() at time zone 'UTC') - make_interval(months => g),'YYYY-MM') from generate_series(5,0,-1) g);
 result jsonb;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'business_id', b.id,
   'last_activity_at', greatest(o.last_at, inv.last_at, cat.last_at, rec.last_at, cnt.last_at, ppl.last_sign_in_at),
   'ai_scan', jsonb_build_object(
     'enabled', public.business_ai_scan_enabled(b.settings),
     'monthly_limit', public.business_ai_scan_limit(b.settings),
     'this_month', coalesce(scan.this_month,0),
     'succeeded', scan.succeeded, 'failed', scan.failed,
     'last_scan_at', scan.last_scan_at,
     'months', scan.months),
   'features', jsonb_build_object(
     'orders', jsonb_build_object('recent',o.recent,'total',o.total,'last_at',o.last_at),
     'invoices', jsonb_build_object('recent',inv.recent,'total',inv.total,'last_at',inv.last_at),
     'catering', jsonb_build_object('recent',cat.recent,'total',cat.total,'last_at',cat.last_at),
     'receipts', jsonb_build_object('recent',rec.recent,'total',rec.total,'last_at',rec.last_at),
     'inventory', jsonb_build_object('recent',cnt.recent,'total',cnt.total,'last_at',cnt.last_at),
     'catalog', jsonb_build_object('recent',item.recent,'total',item.total,'last_at',item.last_at)),
   'people', jsonb_build_object('members',ppl.members,'active_7d',ppl.active_7d,'active_30d',ppl.active_30d,'last_sign_in_at',ppl.last_sign_in_at),
   'branches', loc.branches,
   'setup', jsonb_build_object(
     'admin_signed_in', ppl.admin_signed_in,
     'branch_added', loc.branches > 0,
     'catalog_added', item.total > 0,
     'first_order', o.total > 0,
     'first_invoice', inv.total > 0)
 ) order by b.name), '[]'::jsonb) into result
 from public.businesses b
 cross join lateral (select count(*) filter (where created_at>=since30) recent, count(*) total, max(created_at) last_at from public.orders where business_id=b.id) o
 cross join lateral (select count(*) filter (where created_at>=since30) recent, count(*) total, max(created_at) last_at from public.weekly_invoices where business_id=b.id) inv
 cross join lateral (select count(*) filter (where created_at>=since30) recent, count(*) total, max(created_at) last_at from public.catering_events where business_id=b.id) cat
 cross join lateral (select count(*) filter (where created_at>=since30) recent, count(*) total, max(created_at) last_at from public.purchase_receipts where business_id=b.id) rec
 cross join lateral (select count(*) filter (where submitted_at>=since30) recent, count(*) total, max(submitted_at) last_at from public.branch_inventory_counts where business_id=b.id) cnt
 cross join lateral (select count(*) filter (where updated_at>=since30) recent, count(*) filter (where is_active and archived_at is null) total, max(updated_at) last_at from public.catalog_items where business_id=b.id) item
 cross join lateral (select count(*) filter (where not is_central) branches from public.locations where business_id=b.id) loc
 cross join lateral (
   select count(*) filter (where m.status::text='active') members,
          count(*) filter (where m.status::text='active' and u.last_sign_in_at>=since7) active_7d,
          count(*) filter (where m.status::text='active' and u.last_sign_in_at>=since30) active_30d,
          max(u.last_sign_in_at) filter (where m.status::text='active') last_sign_in_at,
          coalesce(bool_or(m.status::text='active' and m.role::text='CENTRAL_ADMIN' and u.last_sign_in_at is not null), false) admin_signed_in
     from public.business_memberships m left join auth.users u on u.id=m.user_id where m.business_id=b.id) ppl
 cross join lateral (
   select count(*) filter (where scan_started_at>=month_start and scan_status='SUCCEEDED') succeeded,
          count(*) filter (where scan_started_at>=month_start and scan_status='FAILED') failed,
          max(scan_started_at) last_scan_at,
          sum((scan_usage->>month_key)::integer) this_month,
          (select jsonb_agg(jsonb_build_object('month',m,'count',coalesce((select sum((r.scan_usage->>m)::integer) from public.purchase_receipts r where r.business_id=b.id),0)) order by m) from unnest(months) m) months
     from public.purchase_receipts where business_id=b.id) scan;
 return result;
end; $$;
revoke all on function public.platform_business_usage() from public, anon;
grant execute on function public.platform_business_usage() to authenticated;

notify pgrst,'reload schema';
commit;
