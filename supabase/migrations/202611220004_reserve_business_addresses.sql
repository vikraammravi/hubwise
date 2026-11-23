begin;

-- Keep this list in sync with src/features/workspaces/business-address.ts.
-- Existing rows are left unchanged by this guard.
create function public.guard_reserved_business_address() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;

  if new.slug in ('aaha', 'accept-invite', 'activate-account', 'admin', 'api', 'auth', 'b', 'branch',
                  'employee', 'forgot-password', 'login', 'set-password', 'superadmin', 'workspaces') then
    raise exception 'That business address is reserved. Choose a different address.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger guard_reserved_business_address
before insert or update of slug on public.businesses
for each row execute function public.guard_reserved_business_address();

revoke all on function public.guard_reserved_business_address() from public, anon, authenticated;

commit;
