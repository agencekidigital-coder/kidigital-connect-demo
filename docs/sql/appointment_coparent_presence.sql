-- Already applied to the Naïtéa beta database. Backwards compatible with earlier workers.
alter table public.naitea_appointments add column if not exists coparent_present text check (coparent_present in ('yes','no','unsure'));
CREATE OR REPLACE FUNCTION public.naitea_book_online_appointment_with_coparent(p_link uuid, p_rule uuid, p_start timestamp with time zone, p_modality text, p_request uuid, p_email text, p_first text, p_last text, p_phone text, p_price integer, p_duration integer, p_coparent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if p_coparent is null or p_coparent not in ('yes','no','unsure') then raise exception 'INVALID_COPARENT' using errcode='22023';end if;
 result:=public.naitea_book_online_appointment(p_link,p_rule,p_start,p_modality,p_request,p_email,p_first,p_last,p_phone,p_price,p_duration);
 if result->>'code'='CONFIRMED' then
   update public.naitea_appointments set coparent_present=p_coparent where id=(result->>'id')::uuid and request_id=p_request;
   if not found then raise exception 'APPOINTMENT_NOT_FOUND';end if;
 end if;
 return result;
end $function$
;
revoke all on function public.naitea_book_online_appointment_with_coparent(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.naitea_book_online_appointment_with_coparent(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text) to service_role;
CREATE OR REPLACE FUNCTION public.naitea_my_agenda(p_day date, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); a timestamptz; b timestamptz; result jsonb;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_day is null or p_days is null or p_days not between 1 and 42 or p_day not between date '2000-01-01' and date '2100-12-31' then raise exception 'INVALID_PERIOD' using errcode='22023';end if;
 a:=p_day::timestamp at time zone 'Europe/Paris';b:=(p_day+p_days)::timestamp at time zone 'Europe/Paris';
 select jsonb_build_object('appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.service_title,'starts_at',r.starts_at,'ends_at',r.ends_at,'busy_until',r.busy_until,'modality',r.modality,'location_label',r.location_label,'location_details',r.location_details,'status',r.status,'price_cents',r.price_cents,'coparent_present',r.coparent_present,'booking_source',r.booking_source,'confirmation_email_status',r.confirmation_email_status,'family_name',concat_ws(' ',f.first_name,f.last_name)) order by r.starts_at) from public.naitea_appointments r join public.naitea_families f on f.id=r.family_id and f.professional_id=uid where r.professional_id=uid and r.starts_at>=a and r.starts_at<b),'[]'::jsonb),
 'workshops',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'starts_at',w.starts_at,'duration_label',w.duration_label,'status',w.status) order by w.starts_at) from public.naitea_workshops w where w.professional_id=uid and w.starts_at>=a and w.starts_at<b and w.status in ('draft','published','cancelled')),'[]'::jsonb),
 'absences',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'closed_date',c.closed_date,'end_date',c.end_date) order by c.closed_date) from public.naitea_service_closed_days c where c.professional_id=uid and c.closed_date<p_day+p_days and c.end_date>=p_day),'[]'::jsonb)) into result;
 return result;
end $function$
;
