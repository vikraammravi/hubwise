-- Per-business sign-in branding: display name, accent colour and logo, stored in
-- businesses.settings->'branding'. The sign-in page shows it when a user arrives
-- through /b/<slug>, so a business never sees another business's brand.
-- The public lookup returns presentation fields only, for active businesses only.
begin;

create function public.business_login_branding(p_slug text) returns jsonb
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
   'logo_url', branding->>'logo_url');
end; $$;
revoke all on function public.business_login_branding(text) from public;
grant execute on function public.business_login_branding(text) to anon, authenticated;

-- Platform-only. Each call sets the whole branding; empty values clear a field.
-- Logo must be an https URL or a site-relative asset path.
create function public.platform_update_business_branding(p_business_id uuid, p_display_name text, p_accent text, p_logo_url text)
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
 if logo is not null and (length(logo) > 500 or not (logo ~ '^https://[^[:space:]"''<>]+$' or logo ~ '^/[A-Za-z0-9._/-]+$')) then
   raise exception 'Logo must be an https URL or a site path' using errcode='22023';
 end if;
 branding := jsonb_strip_nulls(jsonb_build_object('display_name',display_name,'accent',accent,'logo_url',logo));
 update public.businesses set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{branding}',branding,true), updated_at=clock_timestamp()
   where id=p_business_id;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 return branding;
end; $$;
revoke all on function public.platform_update_business_branding(uuid,text,text,text) from public, anon;
grant execute on function public.platform_update_business_branding(uuid,text,text,text) to authenticated;

-- Public logo bucket. Uploads go through the platform server route (service key);
-- no client insert/update/delete policies are created.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('business-branding', 'business-branding', true, 524288, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Ahaa keeps its existing logo and colour on its sign-in page.
update public.businesses
   set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{branding}',
       coalesce(settings->'branding','{}'::jsonb)||'{"logo_url":"/aaha-logo.png","accent":"#f0a020"}'::jsonb,true)
 where slug='ahaa' and coalesce(settings->'branding'->>'logo_url','')='';

notify pgrst,'reload schema';
commit;
