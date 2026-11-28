-- Appointment payment preparation. No active online payment service until the controlled pilot is opened.
alter table public.naitea_services add column payment_mode text not null default 'onsite', add column deposit_cents integer;
alter table public.naitea_services add constraint naitea_service_payment_mode_check check (
 (payment_mode='onsite' and deposit_cents is null) or
 (payment_mode='free' and price_cents=0 and deposit_cents is null) or
 (payment_mode in ('online','choice') and price_cents>=50 and deposit_cents is null) or
 (payment_mode='deposit' and deposit_cents is not null and deposit_cents>=50 and deposit_cents<price_cents));
alter table public.naitea_services add constraint naitea_service_payment_pilot_scope check(status<>'active' or payment_mode in ('onsite','free'));
grant select(payment_mode,deposit_cents),insert(payment_mode,deposit_cents),update(payment_mode,deposit_cents) on public.naitea_services to authenticated;
alter table public.naitea_appointments drop constraint naitea_appointments_status_check;
alter table public.naitea_appointments add constraint naitea_appointments_status_check check(status in ('pending','confirmed','cancelled'));
alter table public.naitea_appointments add column payment_status text not null default 'not_applicable' check(payment_status in ('not_applicable','pending','paid','expired','failed')), add column amount_paid_cents integer not null default 0 check(amount_paid_cents>=0), add column balance_due_cents integer not null default 0 check(balance_due_cents>=0);
grant select(payment_status,amount_paid_cents,balance_due_cents) on public.naitea_appointments to authenticated;
create index naitea_appointments_active_hold_time on public.naitea_appointments(professional_id,starts_at,busy_until) where status in ('pending','confirmed');
create table public.naitea_appointment_test_payments(
 appointment_id uuid primary key references public.naitea_appointments(id) on delete restrict,
 stripe_account_id text not null check(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 session_id text unique check(session_id ~ '^cs_test_[A-Za-z0-9_]+$'),
 return_hash text not null unique check(return_hash ~ '^[0-9a-f]{64}$'),
 amount_cents integer not null check(amount_cents>=50),
 currency text not null default 'eur' check(currency='eur'),
 state text not null default 'pending' check(state in ('pending','paid','expired','failed')),
 checkout_expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 mail_claimed_at timestamptz
);
alter table public.naitea_appointment_test_payments enable row level security;
revoke all on public.naitea_appointment_test_payments from public,anon,authenticated;
grant select,insert,update on public.naitea_appointment_test_payments to service_role;
CREATE OR REPLACE FUNCTION naitea_private.guard_workshop_appointment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare span tstzrange;
begin
 if new.status='cancelled' or new.starts_at is null then return new;end if;
 if tg_op='UPDATE' then if (new.starts_at,new.duration_label,new.status) is not distinct from (old.starts_at,old.duration_label,old.status) then return new;end if;end if;
 perform naitea_private.schedule_lock(new.professional_id);
 span:=naitea_private.workshop_busy_range(new.starts_at,new.duration_label);
 if exists(select 1 from public.naitea_appointments a where a.professional_id=new.professional_id and a.status in ('confirmed','pending') and tstzrange(a.starts_at,a.busy_until,'[)')&&span) then raise exception 'APPOINTMENT_CONFLICT' using errcode='23P01';end if;
 return new;
end $function$
;
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
 select jsonb_build_object('appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.service_title,'starts_at',r.starts_at,'ends_at',r.ends_at,'busy_until',r.busy_until,'modality',r.modality,'location_label',r.location_label,'location_details',r.location_details,'status',r.status,'price_cents',r.price_cents,'payment_status',r.payment_status,'amount_paid_cents',r.amount_paid_cents,'balance_due_cents',r.balance_due_cents,'coparent_present',r.coparent_present,'booking_source',r.booking_source,'confirmation_email_status',r.confirmation_email_status,'family_name',concat_ws(' ',f.first_name,f.last_name)) order by r.starts_at) from public.naitea_appointments r join public.naitea_families f on f.id=r.family_id and f.professional_id=uid where r.professional_id=uid and r.starts_at>=a and r.starts_at<b),'[]'::jsonb),
 'workshops',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'starts_at',w.starts_at,'duration_label',w.duration_label,'status',w.status) order by w.starts_at) from public.naitea_workshops w where w.professional_id=uid and w.starts_at>=a and w.starts_at<b and w.status in ('draft','published','cancelled')),'[]'::jsonb),
 'absences',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'closed_date',c.closed_date,'end_date',c.end_date) order by c.closed_date) from public.naitea_service_closed_days c where c.professional_id=uid and c.closed_date<p_day+p_days and c.end_date>=p_day),'[]'::jsonb)) into result;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION naitea_private.appointment_slots_for_owner(uid uuid, p_service uuid, p_day date)
 RETURNS TABLE(rule_id uuid, modality text, location_label text, location_details text, starts_at timestamp with time zone, ends_at timestamp with time zone, busy_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare svc public.naitea_services%rowtype; today date:=(now() at time zone 'Europe/Paris')::date;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_day is null or p_day<today or p_day>today+365 then raise exception 'INVALID_DATE' using errcode='22023';end if;
 select * into svc from public.naitea_services s where s.id=p_service and s.professional_id=uid and s.status='active';
 if not found then raise exception 'SERVICE_UNAVAILABLE' using errcode='22023';end if;
 if exists(select 1 from public.naitea_service_closed_days c where c.professional_id=uid and p_day between c.closed_date and c.end_date) then return;end if;
 return query
 with raw as (
  select r.id rid,o->>'modality' mode,o->>'location_label' loc_label,o->>'location_details' loc_details,
  p_day::timestamp+make_interval(mins=>g.minute) wall
  from public.naitea_service_availability r cross join lateral generate_series(r.start_minute,least(r.end_minute-svc.duration_minutes,1440-svc.duration_minutes-svc.buffer_minutes),15) g(minute)
  cross join lateral jsonb_array_elements(r.options) o
  where r.professional_id=uid and r.service_id=svc.id and r.weekday=extract(isodow from p_day) and (o->>'modality')=any(svc.modalities)
 ), times as (
  select raw.*,wall at time zone 'Europe/Paris' as st from raw
 ), ranges as (
  select times.*,st+make_interval(mins=>svc.duration_minutes) en,st+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes) bu from times
 )
 select r.rid,r.mode,r.loc_label,r.loc_details,r.st,r.en,r.bu from ranges r
 where r.st>now() and (r.st at time zone 'Europe/Paris')=r.wall
 and ((r.st-interval '1 hour') at time zone 'Europe/Paris')<>r.wall
 and ((r.st+interval '1 hour') at time zone 'Europe/Paris')<>r.wall
 and (r.bu at time zone 'Europe/Paris')=r.wall+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)
 and not exists(select 1 from public.naitea_appointments a where a.professional_id=uid and a.status in ('confirmed','pending') and a.starts_at<r.bu and a.busy_until>r.st)
 and not exists(select 1 from public.naitea_workshops w where w.professional_id=uid and w.status in ('published','draft') and w.starts_at is not null and naitea_private.workshop_busy_range(w.starts_at,w.duration_label)&&tstzrange(r.st,r.bu,'[)'))
 order by r.st,r.mode,r.rid;
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
 if (select count(*) from public.naitea_appointments a join public.naitea_families f on f.id=a.family_id where a.booking_source='online' and f.email=p_email and a.created_at>now()-interval '1 day')>=5 then return jsonb_build_object('code','RATE_LIMIT');end if;
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
 if (select count(*) from public.naitea_appointments a join public.naitea_families f on f.id=a.family_id where a.booking_source='online' and f.email=p_email and a.created_at>now()-interval '1 day')>=5 then return jsonb_build_object('code','RATE_LIMIT');end if;
 if (p_start at time zone 'Europe/Paris')::date not between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date+365 then return jsonb_build_object('code','UNAVAILABLE');end if;
 select * into slot from naitea_private.appointment_slots_for_owner(uid,svc.id,(p_start at time zone 'Europe/Paris')::date) a where a.rule_id=p_rule and a.starts_at=p_start and a.modality=p_modality;
 if not found then return jsonb_build_object('code','FULL');end if;
 insert into public.naitea_families(professional_id,email,first_name,last_name,phone) values(uid,p_email,btrim(p_first),btrim(p_last),p_phone) on conflict(professional_id,email) do nothing;
 select id into fid from public.naitea_families where professional_id=uid and email=p_email;
 if fid is null then raise exception 'Family unavailable';end if;
 insert into public.naitea_appointments(professional_id,family_id,service_id,request_id,rule_id,service_title,modality,location_label,location_details,starts_at,ends_at,busy_until,price_cents,booking_source,confirmation_email_status)
 values(uid,fid,svc.id,p_request,p_rule,svc.title,slot.modality,slot.location_label,slot.location_details,slot.starts_at,slot.ends_at,slot.busy_until,svc.price_cents,'online','pending') returning id into aid;
 return jsonb_build_object('code','CONFIRMED','id',aid,'instructions',svc.booking_instructions,'title',svc.title,'starts_at',slot.starts_at,'ends_at',slot.ends_at,'modality',slot.modality,'location_label',slot.location_label,'location_details',case when slot.modality='phone' then null else slot.location_details end,'price_cents',svc.price_cents,'travel_fees',slot.modality='home' and coalesce(svc.modality_details->'home'->'fees'->'enabled'='true'::jsonb,false));
end $function$
;
CREATE OR REPLACE FUNCTION naitea_private.public_appointment_service(p_link uuid, p_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare svc public.naitea_services%rowtype; slots jsonb:='[]'::jsonb;
begin
 select * into svc from public.naitea_services where booking_link=p_link and status='active';
 if not found then return null;end if;
 if p_day is not null then
  select coalesce(jsonb_agg(jsonb_build_object('rule_id',a.rule_id,'modality',a.modality,'location_label',a.location_label,'location_details',case when a.modality='phone' then null else a.location_details end,'starts_at',a.starts_at,'ends_at',a.ends_at) order by a.starts_at,a.modality),'[]'::jsonb) into slots from naitea_private.appointment_slots_for_owner(svc.professional_id,svc.id,p_day) a;
 end if;
 return jsonb_build_object('title',svc.title,'business_name',(select nullif(btrim(p.business_name),'') from public.naitea_profiles p where p.id=svc.professional_id),'description',svc.description,'audience',svc.audience,'extra',svc.extra,'price_cents',svc.price_cents,'payment_mode',svc.payment_mode,'deposit_cents',svc.deposit_cents,'duration_minutes',svc.duration_minutes,'modalities',svc.modalities,'travel_fees',coalesce(svc.modality_details->'home'->'fees'->'enabled'='true'::jsonb,false),'slots',slots,'cover_path',case when exists(select 1 from storage.objects where bucket_id='naitea-service-covers' and name=svc.professional_id::text||'/'||svc.id::text||'.jpg') then svc.professional_id::text||'/'||svc.id::text||'.jpg' else null end);
end $function$
;

create function public.naitea_prepare_appointment_checkout(p_link uuid,p_rule uuid,p_start timestamptz,p_modality text,p_request uuid,p_email text,p_first text,p_last text,p_phone text,p_price integer,p_duration integer,p_coparent text,p_hash text,p_expected_mode text,p_expected_deposit integer) returns jsonb language sql set search_path to '' as $$
select naitea_private.prepare_appointment_checkout(p_link,p_rule,p_start,p_modality,p_request,p_email,p_first,p_last,p_phone,p_price,p_duration,p_coparent,p_hash,p_expected_mode,p_expected_deposit)
$$;
revoke all on function naitea_private.prepare_appointment_checkout(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text,text,text,integer) from public,anon,authenticated;
grant execute on function naitea_private.prepare_appointment_checkout(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text,text,text,integer) to service_role;
revoke all on function public.naitea_prepare_appointment_checkout(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.naitea_prepare_appointment_checkout(uuid,uuid,timestamptz,text,uuid,text,text,text,text,integer,integer,text,text,text,integer) to service_role;
create function naitea_private.guard_appointment_test_payment() returns trigger language plpgsql security definer set search_path to '' as $$
begin
 if tg_op='UPDATE' and old.payment_status in ('pending','paid') and new.status='cancelled' and not exists(select 1 from public.naitea_appointment_test_payments p where p.appointment_id=old.id and p.state in ('expired','failed')) then raise exception 'Resolve Stripe payment before cancellation' using errcode='23514';end if;
 if new.status='confirmed' and (new.payment_status in ('pending','paid') or (new.booking_source='online' and exists(select 1 from public.naitea_services s where s.id=new.service_id and s.payment_mode in ('online','deposit')))) then
  if not exists(select 1 from public.naitea_appointment_test_payments p where p.appointment_id=new.id and p.state='paid' and new.payment_status='paid' and new.amount_paid_cents=p.amount_cents and new.balance_due_cents=new.price_cents-p.amount_cents) then raise exception 'Payment required' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function naitea_private.guard_appointment_test_payment() from public,anon,authenticated;
create trigger naitea_guard_appointment_test_payment before insert or update of status,payment_status,amount_paid_cents,balance_due_cents on public.naitea_appointments for each row execute function naitea_private.guard_appointment_test_payment();
create function public.naitea_bind_appointment_checkout(p_appointment_id uuid,p_account text,p_session text) returns boolean language plpgsql set search_path to '' as $$
begin
 if p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' then return false;end if;
 update public.naitea_appointment_test_payments set session_id=p_session where appointment_id=p_appointment_id and stripe_account_id=p_account and state='pending' and (session_id is null or session_id=p_session);
 return found;
end $$;
create function public.naitea_settle_appointment_checkout(p_appointment_id uuid,p_account text,p_session text,p_amount integer,p_currency text,p_outcome text) returns jsonb language plpgsql set search_path to '' as $$
declare uid uuid; a public.naitea_appointments%rowtype; p public.naitea_appointment_test_payments%rowtype; f public.naitea_families%rowtype;
begin
 if p_outcome is null or p_outcome not in ('paid','expired','failed') or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' then return jsonb_build_object('code','INVALID');end if;
 select professional_id into uid from public.naitea_appointments where id=p_appointment_id;
 if not found then return jsonb_build_object('code','UNKNOWN');end if;
 perform naitea_private.schedule_lock(uid);
 select * into a from public.naitea_appointments where id=p_appointment_id for update;
 select * into p from public.naitea_appointment_test_payments where appointment_id=a.id for update;
 if not found or p.stripe_account_id is distinct from p_account or (p.session_id is not null and p.session_id is distinct from p_session) or p.amount_cents is distinct from p_amount or p.currency is distinct from p_currency or p.amount_cents>a.price_cents then return jsonb_build_object('code','MISMATCH');end if;
 if p.state=p_outcome then return jsonb_build_object('code','ALREADY_SETTLED');end if;
 if p.state<>'pending' or a.status<>'pending' then return jsonb_build_object('code','CONFLICT');end if;
 update public.naitea_appointment_test_payments set state=p_outcome,session_id=p_session,settled_at=now(),mail_claimed_at=case when p_outcome='paid' then now() end where appointment_id=a.id;
 if p_outcome='paid' then
  update public.naitea_appointments set status='confirmed',payment_status='paid',amount_paid_cents=p.amount_cents,balance_due_cents=a.price_cents-p.amount_cents where id=a.id;
  select * into f from public.naitea_families where id=a.family_id and professional_id=uid;
  return jsonb_build_object('code','CONFIRMED','id',a.id,'email',f.email,'first_name',f.first_name,'title',a.service_title,'starts_at',a.starts_at,'ends_at',a.ends_at,'modality',a.modality,'location_label',a.location_label,'location_details',case when a.modality='phone' then null else a.location_details end,'price_cents',a.price_cents,'amount_paid_cents',p.amount_cents,'balance_due_cents',a.price_cents-p.amount_cents,'instructions',a.booking_instructions);
 end if;
 update public.naitea_appointments set status='cancelled',cancelled_at=now(),payment_status=p_outcome,balance_due_cents=0,confirmation_email_status='not_requested' where id=a.id;
 return jsonb_build_object('code','RELEASED');
end $$;
create function public.naitea_abort_unstarted_appointment_checkout(p_appointment_id uuid,p_account text) returns boolean language plpgsql set search_path to '' as $$
declare uid uuid;
begin
 select professional_id into uid from public.naitea_appointments where id=p_appointment_id;
 if not found then return false;end if;
 perform naitea_private.schedule_lock(uid);
 update public.naitea_appointment_test_payments set state='failed',settled_at=now() where appointment_id=p_appointment_id and stripe_account_id=p_account and session_id is null and state='pending';
 if not found then return false;end if;
 update public.naitea_appointments set status='cancelled',cancelled_at=now(),payment_status='failed',balance_due_cents=0,confirmation_email_status='not_requested' where id=p_appointment_id and status='pending';
 if not found then raise exception 'Pending appointment missing';end if;
 return true;
end $$;
revoke all on function public.naitea_bind_appointment_checkout(uuid,text,text),public.naitea_settle_appointment_checkout(uuid,text,text,integer,text,text),public.naitea_abort_unstarted_appointment_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.naitea_bind_appointment_checkout(uuid,text,text),public.naitea_settle_appointment_checkout(uuid,text,text,integer,text,text),public.naitea_abort_unstarted_appointment_checkout(uuid,text) to service_role;
