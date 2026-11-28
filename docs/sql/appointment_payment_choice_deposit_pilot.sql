-- Extend only the verified appointment pilot to choice and deposit.
do $$
begin
 if not exists(select 1 from public.naitea_services s join public.naitea_appointments a on a.service_id=s.id join public.naitea_appointment_test_payments p on p.appointment_id=a.id where s.id='165ad658-3a45-4d7b-b8c4-64365312c248' and s.professional_id='529cf1d1-5add-42c3-9b97-31b3b8801693' and s.status='active' and s.payment_mode='online' and a.status='confirmed' and p.state='paid' and p.amount_cents=5000) then raise exception 'Pilot payment not verified';end if;
 if exists(select 1 from public.naitea_appointments where service_id='165ad658-3a45-4d7b-b8c4-64365312c248' and status='pending') then raise exception 'Resolve pending checkout before extending pilot';end if;
 alter table public.naitea_services add constraint naitea_service_payment_pilot_scope_v3 check(status<>'active' or payment_mode in ('onsite','free') or (id='165ad658-3a45-4d7b-b8c4-64365312c248'::uuid and professional_id='529cf1d1-5add-42c3-9b97-31b3b8801693'::uuid and payment_mode in ('online','choice','deposit') and price_cents>=50));
 alter table public.naitea_services drop constraint naitea_service_payment_pilot_scope_v2;
end $$;
CREATE OR REPLACE FUNCTION naitea_private.book_online_appointment(p_link uuid, p_rule uuid, p_start timestamp with time zone, p_modality text, p_request uuid, p_email text, p_first text, p_last text, p_phone text, p_price integer, p_duration integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare svc public.naitea_services%rowtype; uid uuid; slot record; fid uuid; aid uuid; old public.naitea_appointments%rowtype; result jsonb;
begin
 if p_link is null or p_rule is null or p_start is null or p_request is null or p_modality not in ('practice','home','video','phone') or p_modality is null or p_email is distinct from 'contact@naitea.fr' or p_first is null or p_last is null or length(btrim(p_first)) not between 1 and 60 or length(btrim(p_last)) not between 1 and 59 or p_first~'[[:cntrl:]]' or p_last~'[[:cntrl:]]' or p_phone is null or p_phone!~'^\+[1-9][0-9]{7,14}$' then return jsonb_build_object('code','INVALID');end if;
 select professional_id into uid from public.naitea_services where booking_link=p_link and status='active';
 if uid is null then return jsonb_build_object('code','UNAVAILABLE');end if;
 perform pg_advisory_xact_lock(hashtextextended('naitea-online-appointment-email:'||p_email,0));
 perform naitea_private.schedule_lock(uid);
 select * into svc from public.naitea_services where booking_link=p_link and professional_id=uid and status='active';
 if not found then return jsonb_build_object('code','UNAVAILABLE');end if;
 select * into old from public.naitea_appointments where professional_id=uid and request_id=p_request;
 if found then return jsonb_build_object('code','ALREADY_REQUESTED');end if;
 if svc.payment_mode in ('online','deposit') then return jsonb_build_object('code','PAYMENT_REQUIRED');end if;
 if svc.price_cents is distinct from p_price or svc.duration_minutes is distinct from p_duration then return jsonb_build_object('code','CHANGED');end if;
 if (select count(*) from public.naitea_appointments a join public.naitea_families f on f.id=a.family_id where a.booking_source='online' and f.email=p_email and a.created_at>now()-interval '1 day')>=(case when svc.id='165ad658-3a45-4d7b-b8c4-64365312c248'::uuid and uid='529cf1d1-5add-42c3-9b97-31b3b8801693'::uuid and p_email='contact@naitea.fr' then 10 else 5 end) then return jsonb_build_object('code','RATE_LIMIT');end if;
 if (p_start at time zone 'Europe/Paris')::date not between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date+365 then return jsonb_build_object('code','UNAVAILABLE');end if;
 select * into slot from naitea_private.appointment_slots_for_owner(uid,svc.id,(p_start at time zone 'Europe/Paris')::date) a where a.rule_id=p_rule and a.starts_at=p_start and a.modality=p_modality;
 if not found then return jsonb_build_object('code','FULL');end if;
 insert into public.naitea_families(professional_id,email,first_name,last_name,phone) values(uid,p_email,btrim(p_first),btrim(p_last),p_phone) on conflict(professional_id,email) do nothing;
 select id into fid from public.naitea_families where professional_id=uid and email=p_email;
 if fid is null then raise exception 'Family unavailable';end if;
 insert into public.naitea_appointments(professional_id,family_id,service_id,request_id,rule_id,service_title,modality,location_label,location_details,starts_at,ends_at,busy_until,price_cents,booking_source,confirmation_email_status,balance_due_cents)
 values(uid,fid,svc.id,p_request,p_rule,svc.title,slot.modality,slot.location_label,slot.location_details,slot.starts_at,slot.ends_at,slot.busy_until,svc.price_cents,'online','pending',svc.price_cents) returning id into aid;
 return jsonb_build_object('code','CONFIRMED','id',aid,'instructions',svc.booking_instructions,'title',svc.title,'starts_at',slot.starts_at,'ends_at',slot.ends_at,'modality',slot.modality,'location_label',slot.location_label,'location_details',case when slot.modality='phone' then null else slot.location_details end,'price_cents',svc.price_cents,'travel_fees',slot.modality='home' and coalesce(svc.modality_details->'home'->'fees'->'enabled'='true'::jsonb,false));
end $function$
;
CREATE OR REPLACE FUNCTION naitea_private.prepare_appointment_checkout(p_link uuid, p_rule uuid, p_start timestamp with time zone, p_modality text, p_request uuid, p_email text, p_first text, p_last text, p_phone text, p_price integer, p_duration integer, p_coparent text, p_hash text, p_expected_mode text, p_expected_deposit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare svc public.naitea_services%rowtype; uid uuid; slot record; fid uuid; aid uuid; old public.naitea_appointments%rowtype; result jsonb; acct text; amount integer; expiry timestamptz;
begin
 if p_coparent is null or p_coparent not in ('yes','no','unsure') or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_start<=now()+interval '40 minutes' then return jsonb_build_object('code','INVALID');end if;
 if p_link is null or p_rule is null or p_start is null or p_request is null or p_modality not in ('practice','home','video','phone') or p_modality is null or p_email is distinct from 'contact@naitea.fr' or p_first is null or p_last is null or length(btrim(p_first)) not between 1 and 60 or length(btrim(p_last)) not between 1 and 59 or p_first~'[[:cntrl:]]' or p_last~'[[:cntrl:]]' or p_phone is null or p_phone!~'^\+[1-9][0-9]{7,14}$' then return jsonb_build_object('code','INVALID');end if;
 select professional_id into uid from public.naitea_services where booking_link=p_link and status='active';
 if uid is null then return jsonb_build_object('code','UNAVAILABLE');end if;
 perform pg_advisory_xact_lock(hashtextextended('naitea-online-appointment-email:'||p_email,0));
 perform naitea_private.schedule_lock(uid);
 select * into svc from public.naitea_services where booking_link=p_link and professional_id=uid and status='active';
 if not found then return jsonb_build_object('code','UNAVAILABLE');end if;
 select * into old from public.naitea_appointments where professional_id=uid and request_id=p_request;
 if found then return jsonb_build_object('code','ALREADY_REQUESTED');end if;
 if svc.payment_mode not in ('online','choice','deposit') or svc.payment_mode is distinct from p_expected_mode or svc.deposit_cents is distinct from p_expected_deposit or svc.price_cents is distinct from p_price or svc.duration_minutes is distinct from p_duration then return jsonb_build_object('code','CHANGED');end if;
 select stripe_account_id into acct from public.naitea_stripe_test_accounts where professional_id=uid;
 if not found then return jsonb_build_object('code','STRIPE_NOT_CONNECTED');end if;
 amount:=case when svc.payment_mode='deposit' then svc.deposit_cents else svc.price_cents end;
 if amount<50 then return jsonb_build_object('code','INVALID');end if;
 if (select count(*) from public.naitea_appointments a join public.naitea_families f on f.id=a.family_id where a.booking_source='online' and f.email=p_email and a.created_at>now()-interval '1 day')>=(case when svc.id='165ad658-3a45-4d7b-b8c4-64365312c248'::uuid and uid='529cf1d1-5add-42c3-9b97-31b3b8801693'::uuid and p_email='contact@naitea.fr' then 10 else 5 end) then return jsonb_build_object('code','RATE_LIMIT');end if;
 if (p_start at time zone 'Europe/Paris')::date not between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date+365 then return jsonb_build_object('code','UNAVAILABLE');end if;
 select * into slot from naitea_private.appointment_slots_for_owner(uid,svc.id,(p_start at time zone 'Europe/Paris')::date) a where a.rule_id=p_rule and a.starts_at=p_start and a.modality=p_modality;
 if not found then return jsonb_build_object('code','FULL');end if;
 insert into public.naitea_families(professional_id,email,first_name,last_name,phone) values(uid,p_email,btrim(p_first),btrim(p_last),p_phone) on conflict(professional_id,email) do nothing;
 select id into fid from public.naitea_families where professional_id=uid and email=p_email;
 if fid is null then raise exception 'Family unavailable';end if;
 insert into public.naitea_appointments(professional_id,family_id,service_id,request_id,rule_id,service_title,modality,location_label,location_details,starts_at,ends_at,busy_until,price_cents,booking_source,confirmation_email_status,status,payment_status,coparent_present,balance_due_cents)
 values(uid,fid,svc.id,p_request,p_rule,svc.title,slot.modality,slot.location_label,slot.location_details,slot.starts_at,slot.ends_at,slot.busy_until,svc.price_cents,'online','pending','pending','pending',p_coparent,svc.price_cents) returning id into aid;
 expiry:=date_trunc('second',now()+interval '35 minutes');
 insert into public.naitea_appointment_test_payments(appointment_id,stripe_account_id,return_hash,amount_cents,checkout_expires_at) values(aid,acct,p_hash,amount,expiry);
 return jsonb_build_object('code','HELD','booking_id',aid,'account',acct,'amount_cents',amount,'unit_cents',amount,'seats',1,'title',svc.title,'payment_mode',svc.payment_mode,'expires_at',extract(epoch from expiry)::bigint);
end $function$
;
