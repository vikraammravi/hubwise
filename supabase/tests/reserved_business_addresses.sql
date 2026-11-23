-- Run inside a rollback-only transaction after installing the address guard.
do $$
declare
  fixture_id uuid;
  fixture_slug text := 'address-test-' || replace(gen_random_uuid()::text, '-', '');
  reserved_slug text;
begin
  insert into public.businesses (name, slug, status, isolation_ready)
  values ('Address guard fixture', fixture_slug, 'provisioning', false)
  returning id into fixture_id;

  foreach reserved_slug in array array['aaha', 'login', 'admin', 'superadmin', 'accept-invite'] loop
    begin
      insert into public.businesses (name, slug, status, isolation_ready)
      values ('Reserved address fixture', reserved_slug, 'provisioning', false);
      raise exception 'Reserved address % was accepted on insert', reserved_slug;
    exception when invalid_parameter_value then
      if sqlerrm <> 'That business address is reserved. Choose a different address.' then
        raise;
      end if;
    end;

    begin
      update public.businesses set slug = reserved_slug where id = fixture_id;
      raise exception 'Reserved address % was accepted on update', reserved_slug;
    exception when invalid_parameter_value then
      if sqlerrm <> 'That business address is reserved. Choose a different address.' then
        raise;
      end if;
    end;
  end loop;

  if (select slug from public.businesses where id = fixture_id) is distinct from fixture_slug then
    raise exception 'Rejected updates did not preserve the business address';
  end if;
end;
$$;
