-- Follow-up to 202611220001/0002: a branding "palette" decides the signed-in look.
-- "warm" keeps the original Ahaa theme and logo; anything else gets the neutral
-- theme with the business's own accent and mark. Saving branding from the console
-- now preserves keys it does not manage (such as palette).
-- Release order: apply before deploying app code that reads the palette, or Ahaa
-- would briefly render with the neutral theme.
begin;

create or replace function public.business_login_branding(p_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare business public.businesses%rowtype; branding jsonb;
begin
 if p_slug is null or length(p_slug) not between 2 and 60 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return null; end if;
 select * into business from public.businesses where slug=p_slug and status='active' and isolation_ready;
 if not found then return null; end if;
 branding := coalesce(business.settings->'branding','{}'::jsonb);
 return jsonb_build_object(
   'name', coalesce(nullif(branding->>'display_name',''), business.name),
   'accent', branding->>'accent',
   'logo_url', branding->>'logo_url',
   'palette', case when branding->>'palette'='warm' then 'warm' else 'neutral' end);
end; $$;

create or replace function public.platform_update_business_branding(p_business_id uuid, p_display_name text, p_accent text, p_logo_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 display_name text := nullif(trim(coalesce(p_display_name,'')),'');
 accent text := lower(nullif(trim(coalesce(p_accent,'')),''));
 logo text := nullif(trim(coalesce(p_logo_url,'')),'');
 current_settings jsonb;
 branding jsonb;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if display_name is not null and length(display_name) > 80 then raise exception 'Display name is too long' using errcode='22023'; end if;
 if accent is not null and accent !~ '^#[0-9a-f]{6}$' then raise exception 'Accent must be a #RRGGBB colour' using errcode='22023'; end if;
 if logo is not null and (length(logo) > 500 or not (logo ~ '^https://[^[:space:]"''<>]+$' or logo ~ '^/[A-Za-z0-9._-][A-Za-z0-9._/-]*$')) then
   raise exception 'Logo must be an https URL or a site path' using errcode='22023';
 end if;
 select settings into current_settings from public.businesses where id=p_business_id for update;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 branding := (coalesce(current_settings->'branding','{}'::jsonb) - 'display_name' - 'accent' - 'logo_url')
   || jsonb_strip_nulls(jsonb_build_object('display_name',display_name,'accent',accent,'logo_url',logo));
 update public.businesses set settings=jsonb_set(coalesce(current_settings,'{}'::jsonb),'{branding}',branding,true), updated_at=clock_timestamp()
   where id=p_business_id;
 return branding;
end; $$;

-- Ahaa keeps its original signed-in theme and logo.
update public.businesses
   set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{branding}',coalesce(settings->'branding','{}'::jsonb)||'{"palette":"warm"}'::jsonb,true)
 where slug='ahaa';

notify pgrst,'reload schema';
commit;
