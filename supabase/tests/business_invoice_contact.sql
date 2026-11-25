-- Run only inside a rolled-back transaction after 202611240001_business_invoice_contact.sql.
do $$
declare
  actor uuid; outsider uuid; setup_business uuid; ahaa uuid; payload jsonb; blocked boolean; bad text[];
  fixture_slug text := 'invoice-' || replace(gen_random_uuid()::text,'-','');
begin
  select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
    where a.is_active and p.status::text='active' limit 1;
  select id into outsider from public.profiles where status::text='active'
    and not exists(select 1 from public.platform_administrators a where a.user_id=profiles.id and a.is_active) limit 1;
  select id into ahaa from public.businesses where slug='ahaa';
  if actor is null or outsider is null or ahaa is null then raise exception 'Invoice contact test prerequisites unavailable'; end if;
  if has_function_privilege('anon','public.platform_update_business_invoice_contact(uuid,text,text,text,text)','EXECUTE') then
    raise exception 'Anonymous users can change invoice details';
  end if;
  if (select settings->'invoice_contact'->>'name' from public.businesses where id=ahaa) is distinct from 'Aaha Truly South'
     or (select settings->'invoice_contact'->>'address' from public.businesses where id=ahaa) not like E'1177 Brimley Road\n%' then
    raise exception 'Ahaa invoice details were not seeded';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  setup_business := (public.platform_create_business('Invoice fixture', fixture_slug)->>'id')::uuid;

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked := false;
  begin perform public.platform_update_business_invoice_contact(ahaa,'Hijack',null,null,null); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Non-platform user changed invoice details'; end if;

  perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach bad slice 1 in array array[
    array[repeat('x',121), null, null, null],
    array[null, repeat('x',301), null, null],
    array[null, E'a\nb\nc\nd\ne', null, null],
    array[null, null, E'1\n2', null],
    array[null, null, null, 'not-an-email']] loop
    blocked := false;
    begin perform public.platform_update_business_invoice_contact(setup_business,bad[1],bad[2],bad[3],bad[4]); exception when sqlstate '22023' then blocked := true; end;
    if not blocked then raise exception 'Invalid invoice details accepted: %', bad; end if;
  end loop;

  payload := public.platform_update_business_invoice_contact(setup_business,'  Fixture Ltd ',E'1 Main St\nToronto ON','',' billing@fixture.example ');
  if payload <> '{"name":"Fixture Ltd","address":"1 Main St\nToronto ON","email":"billing@fixture.example"}'::jsonb then raise exception 'Unexpected contact: %', payload; end if;
  if (select settings->'invoice_contact' from public.businesses where id=setup_business) <> payload then raise exception 'Contact not stored'; end if;

  -- Clearing every field removes the key; other settings are untouched.
  perform public.platform_update_business_branding(setup_business,'Fixture',null,null);
  perform public.platform_update_business_invoice_contact(setup_business,'','','','');
  if (select settings ? 'invoice_contact' or settings->'branding'->>'display_name' is distinct from 'Fixture' from public.businesses where id=setup_business) then
    raise exception 'Clearing invoice details changed other settings';
  end if;
end $$;
