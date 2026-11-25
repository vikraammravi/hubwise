-- Run only inside a rolled-back transaction after 202611250001_platform_business_usage.sql.
do $$
declare
  actor uuid; outsider uuid; ahaa uuid; fixture uuid; usage jsonb; entry jsonb; blocked boolean;
  ahaa_admin uuid; ahaa_receipt uuid;
  fixture_slug text := 'usage-' || replace(gen_random_uuid()::text,'-','');
begin
  select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
    where a.is_active and p.status::text='active' limit 1;
  select id into outsider from public.profiles where status::text='active'
    and not exists(select 1 from public.platform_administrators a where a.user_id=profiles.id and a.is_active) limit 1;
  select id into ahaa from public.businesses where slug='ahaa';
  if actor is null or outsider is null or ahaa is null then raise exception 'Usage test prerequisites unavailable'; end if;

  -- Defaults keep the previous behaviour; malformed values fall back safely.
  if not public.business_ai_scan_enabled('{}') or public.business_ai_scan_limit('{}') <> 100 then raise exception 'Wrong scan defaults'; end if;
  if public.business_ai_scan_enabled('{"ai_scan":{"enabled":false}}') then raise exception 'Disabled scanning reads as enabled'; end if;
  if public.business_ai_scan_limit('{"ai_scan":{"monthly_limit":"lots"}}') <> 100 or public.business_ai_scan_limit('{"ai_scan":{"monthly_limit":-5}}') <> 100 then
    raise exception 'Malformed allowance not defaulted';
  end if;

  foreach entry in array array['"platform_business_usage()"'::jsonb, '"platform_set_business_ai_scan(uuid,boolean,integer)"'::jsonb] loop
    if has_function_privilege('anon','public.'||(entry#>>'{}'),'EXECUTE') then raise exception 'Anonymous users can run %', entry; end if;
  end loop;
  if has_function_privilege('authenticated','public.business_ai_scan_limit(jsonb)','EXECUTE') then raise exception 'Helper exposed to clients'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked := false;
  begin perform public.platform_business_usage(); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Non-platform user read usage'; end if;
  blocked := false;
  begin perform public.platform_set_business_ai_scan(ahaa,false,0); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Non-platform user changed AI scanning'; end if;

  perform set_config('request.jwt.claim.sub',actor::text,true);
  fixture := (public.platform_create_business('Usage fixture', fixture_slug)->>'id')::uuid;
  foreach entry in array array['[-1]'::jsonb, '[10001]'::jsonb] loop
    blocked := false;
    begin perform public.platform_set_business_ai_scan(fixture,true,(entry->>0)::integer); exception when sqlstate '22023' then blocked := true; end;
    if not blocked then raise exception 'Invalid allowance accepted: %', entry; end if;
  end loop;
  blocked := false;
  begin perform public.platform_set_business_ai_scan(gen_random_uuid(),true,5); exception when sqlstate 'P0002' then blocked := true; end;
  if not blocked then raise exception 'Unknown business accepted'; end if;
  perform public.platform_set_business_ai_scan(fixture,true,100);
  if (select settings ? 'ai_scan' from public.businesses where id=fixture) then raise exception 'Default setting was stored'; end if;
  if public.platform_set_business_ai_scan(fixture,false,25) <> '{"enabled":false,"monthly_limit":25}'::jsonb then raise exception 'Setting not returned'; end if;

  usage := public.platform_business_usage();
  select value into entry from jsonb_array_elements(usage) where value->>'business_id' = fixture::text;
  if entry is null then raise exception 'Fixture missing from usage'; end if;
  if entry->'ai_scan'->>'enabled' <> 'false' or (entry->'ai_scan'->>'monthly_limit')::int <> 25 or (entry->'ai_scan'->>'this_month')::int <> 0
     or jsonb_array_length(entry->'ai_scan'->'months') <> 6 then raise exception 'Fixture scan usage wrong: %', entry->'ai_scan'; end if;
  if entry->'setup' <> '{"admin_signed_in":false,"branch_added":false,"catalog_added":false,"first_order":false,"first_invoice":false}'::jsonb then
    raise exception 'Fixture setup wrong: %', entry->'setup';
  end if;
  if (entry->'features'->'orders'->>'total')::int <> 0 or entry->'last_activity_at' <> 'null'::jsonb then raise exception 'Fixture features wrong'; end if;
  select value into entry from jsonb_array_elements(usage) where value->>'business_id' = ahaa::text;
  if entry is null then raise exception 'Ahaa missing from usage'; end if;
  -- Counts and dates only: no money, names or contact details leave this function.
  if usage::text ~* '(amount|total_amount|price|subtotal|email|phone|customer|file_name)' then raise exception 'Usage exposes record details'; end if;

  -- A disabled business or one at its allowance cannot start a scan.
  execute 'reset role';
  if (entry->'features'->'orders'->>'total')::int <> (select count(*) from public.orders where business_id=ahaa) then raise exception 'Ahaa order count wrong'; end if;
  select m.user_id into ahaa_admin from public.business_memberships m join public.profiles p on p.id=m.user_id
    where m.business_id=ahaa and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and p.status::text='active' limit 1;
  select id into ahaa_receipt from public.purchase_receipts where business_id=ahaa and location_id is null and deleted_at is null limit 1;
  if ahaa_admin is not null and ahaa_receipt is not null then
    update public.businesses set settings=jsonb_set(settings,'{ai_scan}','{"enabled":false,"monthly_limit":100}') where id=ahaa;
    if public.reserve_receipt_scan_for_business(ahaa,ahaa_receipt,ahaa_admin) then raise exception 'Disabled business started a scan'; end if;
    update public.businesses set settings=jsonb_set(settings,'{ai_scan}','{"enabled":true,"monthly_limit":0}') where id=ahaa;
    if public.reserve_receipt_scan_for_business(ahaa,ahaa_receipt,ahaa_admin) then raise exception 'Business over its allowance started a scan'; end if;
  else
    raise notice 'Skipped scan reservation checks: no Ahaa admin receipt available';
  end if;
end $$;
