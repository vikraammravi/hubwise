-- Per-business invoice contact details (name on invoices, address, phone, email), stored in
-- businesses.settings->'invoice_contact' and printed in the "From" block of that business's
-- invoices. Replaces Ahaa's details that were hard-coded in the invoice templates; Ahaa is
-- seeded with those same details so its invoices do not change.
-- Release order: apply before deploying app code that reads it, or Ahaa's invoices would show
-- only its business name until this runs.
begin;

create or replace function public.platform_update_business_invoice_contact(p_business_id uuid, p_name text, p_address text, p_phone text, p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_name text := nullif(trim(coalesce(p_name,'')),'');
 v_address text := nullif(trim(coalesce(p_address,'')),'');
 v_phone text := nullif(trim(coalesce(p_phone,'')),'');
 v_email text := nullif(trim(coalesce(p_email,'')),'');
 current_settings jsonb;
 contact jsonb;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if (v_name is not null and (length(v_name) > 120 or v_name ~ '[\n\r]'))
    or (v_address is not null and (length(v_address) > 300 or array_length(string_to_array(v_address, E'\n'), 1) > 4))
    or (v_phone is not null and (length(v_phone) > 40 or v_phone ~ '[\n\r]'))
    or (v_email is not null and (length(v_email) > 120 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
   raise exception 'Check the invoice details' using errcode='22023';
 end if;
 select settings into current_settings from public.businesses where id=p_business_id for update;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 contact := jsonb_strip_nulls(jsonb_build_object('name',v_name,'address',v_address,'phone',v_phone,'email',v_email));
 update public.businesses
    set settings = case when contact = '{}'::jsonb then coalesce(current_settings,'{}'::jsonb) - 'invoice_contact'
                        else jsonb_set(coalesce(current_settings,'{}'::jsonb),'{invoice_contact}',contact,true) end,
        updated_at = clock_timestamp()
  where id=p_business_id;
 return contact;
end; $$;
revoke all on function public.platform_update_business_invoice_contact(uuid,text,text,text,text) from public, anon;
grant execute on function public.platform_update_business_invoice_contact(uuid,text,text,text,text) to authenticated;

-- Ahaa keeps the details its invoices have always shown.
update public.businesses
   set settings = jsonb_set(coalesce(settings,'{}'::jsonb),'{invoice_contact}',
       '{"name":"Aaha Truly South","address":"1177 Brimley Road\nScarborough ON M1P 3G5","phone":"+1 226 724 3456","email":"aahatrulysouth@gmail.com"}'::jsonb,true)
 where slug='ahaa' and not (coalesce(settings,'{}'::jsonb) ? 'invoice_contact');

notify pgrst,'reload schema';
commit;
