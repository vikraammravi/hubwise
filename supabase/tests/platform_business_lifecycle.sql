-- Execute inside a rollback-only transaction on a database with onboarding installed.
do $$
declare
  actor uuid;
  owner_id uuid;
  owner_email text;
  ahaa uuid;
  empty_id uuid;
  customer uuid;
  fixture_location uuid;
  suffix text := replace(gen_random_uuid()::text, '-', '');
  blocked boolean;
begin
  select a.user_id into strict actor
    from public.platform_administrators a join public.profiles p on p.id = a.user_id
    where a.is_active and p.status::text = 'active' limit 1;
  select p.id, p.email into strict owner_id, owner_email
    from public.profiles p where p.status::text = 'active' and p.email is not null
      and not exists (select 1 from public.platform_administrators a where a.user_id = p.id and a.is_active)
    limit 1;
  select id into strict ahaa from public.businesses where slug = 'ahaa';
  if has_function_privilege('anon', 'public.platform_delete_business(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.platform_set_business_access(uuid,boolean)', 'EXECUTE') then
    raise exception 'Anonymous users can execute business lifecycle functions';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', actor::text, true);
  empty_id := (public.platform_create_business('Empty lifecycle fixture', 'life-empty-' || suffix)->>'id')::uuid;
  customer := (public.platform_create_business('Active lifecycle fixture', 'life-active-' || suffix)->>'id')::uuid;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  blocked := false;
  begin
    perform public.platform_delete_business(empty_id);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Non-platform user deleted a business'; end if;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.platform_confirm_business_logo_upload(empty_id);
  perform public.platform_delete_business(empty_id);
  if exists (select 1 from public.businesses where id = empty_id)
     or not exists (select 1 from public.platform_audit_log where entity_type = 'businesses'
       and entity_id = empty_id::text and actor_id = actor and operation = 'DELETE') then
    raise exception 'Empty business was not deleted and audited';
  end if;
  blocked := false;
  begin
    perform public.platform_confirm_business_logo_upload(empty_id);
  exception when no_data_found then blocked := true;
  end;
  if not blocked then raise exception 'Logo upload accepted a deleted business'; end if;

  perform public.platform_assign_initial_owner(customer, owner_email);
  perform public.activate_platform_business(customer);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.headers', jsonb_build_object('x-business-id', customer)::text, true);
  insert into public.locations(name, is_central) values('Lifecycle fixture location', true)
    returning id into fixture_location;
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  blocked := false;
  begin
    perform public.platform_delete_business(customer);
  exception when object_not_in_prerequisite_state or insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Active tenant deletion was accepted'; end if;

  blocked := false;
  begin
    perform public.platform_set_business_access(ahaa, true);
  exception when object_not_in_prerequisite_state or insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Ahaa lifecycle protection failed'; end if;

  perform public.platform_set_business_access(customer, true);
  if not exists (select 1 from public.businesses where id = customer and status = 'suspended')
     or not exists (select 1 from public.business_memberships where business_id = customer and user_id = owner_id) then
    raise exception 'Suspension did not preserve membership';
  end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.headers', jsonb_build_object('x-business-id', customer)::text, true);
  blocked := false;
  begin
    blocked := not exists (select 1 from public.locations where id = fixture_location);
  exception when insufficient_privilege or raise_exception then blocked := true;
  end;
  if not blocked then raise exception 'Suspended owner could read existing records'; end if;
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.platform_set_business_access(customer, false);
  if not exists (select 1 from public.businesses where id = customer and status = 'active' and isolation_ready) then
    raise exception 'Restore did not return customer to active isolated status';
  end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.headers', jsonb_build_object('x-business-id', customer)::text, true);
  if public.current_business_id() is distinct from customer then
    raise exception 'Restored owner could not enter the workspace';
  end if;
  perform set_config('test.lifecycle_location', fixture_location::text, true);
  perform set_config('test.lifecycle_business', customer::text, true);
end $$;

-- Read in a separate statement, matching a new request after the restore.
do $$
begin
  if not exists (select 1 from public.locations
    where id = current_setting('test.lifecycle_location')::uuid
      and business_id = current_setting('test.lifecycle_business')::uuid) then
    raise exception 'Restored owner could not read the preserved record';
  end if;
  reset role;
end $$;
