-- Controls setup cleanup and access to isolated workspaces. Does not change existing businesses.
-- Apply only where explicit platform administrators may execute the lifecycle RPCs.
begin;

create function public.platform_delete_business(p_business_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare business public.businesses%rowtype;
begin
  if not public.platform_is_administrator() then
    raise exception 'Platform access is required' using errcode='42501';
  end if;
  select * into business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'Business not found' using errcode='P0002'; end if;
  if business.slug in ('ahaa','aaha') then
    raise exception 'The founding business is protected' using errcode='42501';
  end if;
  if business.status<>'provisioning' or business.isolation_ready
     or business.settings not in ('{}'::jsonb, '{"branding":{}}'::jsonb)
     or exists(select 1 from public.business_memberships where business_id=p_business_id)
     or exists(select 1 from public.platform_owner_invitations where business_id=p_business_id)
     or exists(select 1 from storage.objects where bucket_id='business-branding' and split_part(name,'/',1)=p_business_id::text) then
    raise exception 'Only an empty business in setup can be deleted' using errcode='55000';
  end if;
  -- Foreign keys also reject business records or a reference created during setup.
  -- The existing business_audit trigger records the deletion and its actor.
  delete from public.businesses where id=p_business_id;
end; $$;

create function public.platform_set_business_access(p_business_id uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path='' as $$
declare business public.businesses%rowtype;
begin
  if not public.platform_is_administrator() then
    raise exception 'Platform access is required' using errcode='42501';
  end if;
  select * into business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'Business not found' using errcode='P0002'; end if;
  if business.slug in ('ahaa','aaha') then
    raise exception 'The founding business is protected' using errcode='42501';
  end if;
  if p_suspended is null or not business.isolation_ready
     or business.status <> (case when p_suspended then 'active' else 'suspended' end) then
    raise exception 'The requested access change is unavailable' using errcode='55000';
  end if;
  if not p_suspended and not exists (
    select 1 from public.business_memberships m join public.profiles p on p.id=m.user_id
    where m.business_id=p_business_id and m.role::text='CENTRAL_ADMIN'
      and m.status::text='active' and p.status::text='active'
  ) then
    raise exception 'An active business admin is required to restore access' using errcode='55000';
  end if;
  update public.businesses set status=case when p_suspended then 'suspended' else 'active' end,
    updated_at=clock_timestamp() where id=p_business_id;
end; $$;

revoke all on function public.platform_delete_business(uuid),public.platform_set_business_access(uuid,boolean) from public,anon;
grant execute on function public.platform_delete_business(uuid),public.platform_set_business_access(uuid,boolean) to authenticated;

-- Storage uploads commit outside the business transaction. Wait for any concurrent
-- deletion so the caller can clean up the uploaded object if the business is gone.
create function public.platform_confirm_business_logo_upload(p_business_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.platform_is_administrator() then
    raise exception 'Platform access is required' using errcode='42501';
  end if;
  perform 1 from public.businesses where id=p_business_id for key share;
  if not found then raise exception 'Business not found' using errcode='P0002'; end if;
end; $$;
revoke all on function public.platform_confirm_business_logo_upload(uuid) from public,anon;
grant execute on function public.platform_confirm_business_logo_upload(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
