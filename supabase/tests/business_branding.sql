-- Run only inside a rolled-back transaction after 202611220001_business_branding.sql.
do $$
declare
  actor uuid; outsider uuid; setup_business uuid; ahaa uuid; payload jsonb; blocked boolean;
  fixture_slug text := 'brand-' || replace(gen_random_uuid()::text,'-','');
begin
  select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
    where a.is_active and p.status::text='active' limit 1;
  select id into outsider from public.profiles where status::text='active'
    and not exists(select 1 from public.platform_administrators a where a.user_id=profiles.id and a.is_active) limit 1;
  select id into ahaa from public.businesses where slug='ahaa';
  if actor is null or outsider is null or ahaa is null then raise exception 'Branding test prerequisites unavailable'; end if;
  if has_function_privilege('anon','public.platform_update_business_branding(uuid,text,text,text)','EXECUTE') then
    raise exception 'Anonymous users can change branding';
  end if;
  if not exists(select 1 from storage.buckets where id='business-branding' and public and file_size_limit=524288
                and allowed_mime_types @> array['image/png'] and not ('image/svg+xml' = any(allowed_mime_types))) then
    raise exception 'Branding bucket missing or misconfigured';
  end if;

  -- Anonymous lookup: presentation fields only, active businesses only.
  execute 'set local role anon';
  payload := public.business_login_branding('ahaa');
  if payload->>'name' is null or payload->>'logo_url' <> '/aaha-logo.png' or payload->>'palette' <> 'warm' then raise exception 'Ahaa branding not returned: %', payload; end if;
  if payload ? 'id' or payload ? 'slug' or payload ? 'status' or payload ? 'settings' then raise exception 'Lookup exposes more than branding: %', payload; end if;
  if public.business_login_branding('no-such-business') is not null then raise exception 'Unknown business returned branding'; end if;
  if public.business_login_branding('Bad Slug!') is not null or public.business_login_branding(null) is not null then raise exception 'Invalid slug returned branding'; end if;

  -- Platform-only updates with validation.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  setup_business := (public.platform_create_business('Branding fixture', fixture_slug)->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked := false;
  begin perform public.platform_update_business_branding(ahaa,'Hijack',null,null); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Non-platform user changed branding'; end if;

  perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach payload in array array[
    jsonb_build_object('name','x','accent','red','logo',null),
    jsonb_build_object('name','x','accent','#12345','logo',null),
    jsonb_build_object('name','x','accent',null,'logo','javascript:alert(1)'),
    jsonb_build_object('name','x','accent',null,'logo','http://insecure.example/logo.png'),
    jsonb_build_object('name','x','accent',null,'logo','//evil.example/logo.png'),
    jsonb_build_object('name','x','accent',null,'logo','https://ok.example/a b.png'),
    jsonb_build_object('name',repeat('n',81),'accent',null,'logo',null)] loop
    blocked := false;
    begin perform public.platform_update_business_branding(setup_business,payload->>'name',payload->>'accent',payload->>'logo');
    exception when invalid_parameter_value then blocked := true; end;
    if not blocked then raise exception 'Invalid branding accepted: %', payload; end if;
  end loop;
  blocked := false;
  begin perform public.platform_update_business_branding(gen_random_uuid(),'Ghost',null,null); exception when no_data_found then blocked := true; end;
  if not blocked then raise exception 'Unknown business branding accepted'; end if;

  payload := public.platform_update_business_branding(setup_business,'  Spice Route Kitchens ','#0EA5E9','https://cdn.example/logo.png');
  if payload <> '{"display_name":"Spice Route Kitchens","accent":"#0ea5e9","logo_url":"https://cdn.example/logo.png"}'::jsonb then raise exception 'Branding not normalised: %', payload; end if;
  -- A business still in setup is not exposed to the public lookup.
  execute 'set local role anon';
  if public.business_login_branding(fixture_slug) is not null then raise exception 'Setup business exposed before activation'; end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  -- Clearing returns to defaults (name falls back to the business name).
  payload := public.platform_update_business_branding(setup_business,'',null,'');
  if payload <> '{}'::jsonb then raise exception 'Branding not cleared: %', payload; end if;
  -- Saving from the console keeps keys it does not manage (the palette).
  execute 'set local role postgres';
  update public.businesses set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{branding}','{"palette":"warm"}'::jsonb,true) where id=setup_business;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  payload := public.platform_update_business_branding(setup_business,'Renamed',null,null);
  if payload <> '{"palette":"warm","display_name":"Renamed"}'::jsonb then raise exception 'Palette not preserved: %', payload; end if;
  execute 'set local role postgres';
  if not exists(select 1 from public.platform_audit_log where entity_type='businesses' and entity_id=setup_business::text and operation='UPDATE' and actor_id=actor) then
    raise exception 'Branding change was not audited';
  end if;
  raise notice 'PASS: branding lookup scope, palette, validation, platform-only updates, clearing, palette preserved and audit';
end $$;
