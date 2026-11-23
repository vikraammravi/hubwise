-- Follow-up to 202611220001: a logo "site path" must not start with "//",
-- which browsers load from another host (protocol-relative URL).
begin;

create or replace function public.platform_update_business_branding(p_business_id uuid, p_display_name text, p_accent text, p_logo_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 display_name text := nullif(trim(coalesce(p_display_name,'')),'');
 accent text := lower(nullif(trim(coalesce(p_accent,'')),''));
 logo text := nullif(trim(coalesce(p_logo_url,'')),'');
 branding jsonb;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if display_name is not null and length(display_name) > 80 then raise exception 'Display name is too long' using errcode='22023'; end if;
 if accent is not null and accent !~ '^#[0-9a-f]{6}$' then raise exception 'Accent must be a #RRGGBB colour' using errcode='22023'; end if;
 if logo is not null and (length(logo) > 500 or not (logo ~ '^https://[^[:space:]"''<>]+$' or logo ~ '^/[A-Za-z0-9._-][A-Za-z0-9._/-]*$')) then
   raise exception 'Logo must be an https URL or a site path' using errcode='22023';
 end if;
 branding := jsonb_strip_nulls(jsonb_build_object('display_name',display_name,'accent',accent,'logo_url',logo));
 update public.businesses set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{branding}',branding,true), updated_at=clock_timestamp()
   where id=p_business_id;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 return branding;
end; $$;

-- Clear any protocol-relative logo stored before this fix.
update public.businesses set settings=jsonb_set(settings,'{branding}',(settings->'branding')-'logo_url',true)
 where settings->'branding'->>'logo_url' like '//%';

notify pgrst,'reload schema';
commit;
