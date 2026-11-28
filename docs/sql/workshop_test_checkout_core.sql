
-- Test-only direct Checkout. No production keys, charges, or automatic refunds.
alter table public.naitea_bookings add column if not exists payment_status text not null default 'not_applicable' check(payment_status in ('not_applicable','pending','paid','expired','failed')), add column if not exists amount_paid_cents integer not null default 0 check(amount_paid_cents>=0);
grant select(payment_status,amount_paid_cents) on public.naitea_bookings to authenticated;
create table public.naitea_workshop_test_payments(
 booking_id uuid primary key references public.naitea_bookings(id) on delete restrict,
 stripe_account_id text not null check(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 session_id text unique check(session_id ~ '^cs_test_[A-Za-z0-9_]+$'),
 return_hash text not null unique check(return_hash ~ '^[0-9a-f]{64}$'),
 amount_cents integer not null check(amount_cents>=50),
 currency text not null default 'eur' check(currency='eur'),
 checkout_expires_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','paid','expired','failed')),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 mail_claimed_at timestamptz
);
alter table public.naitea_workshop_test_payments enable row level security;
revoke all on public.naitea_workshop_test_payments from public,anon,authenticated;
grant select,insert,update on public.naitea_workshop_test_payments to service_role;
-- Never confirm a required-online booking by the old instant or email-link path.
create function naitea_private.guard_test_payment_booking() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and exists(select 1 from public.naitea_workshops w where w.id=new.workshop_id and w.payment_mode='online') and not exists(select 1 from public.naitea_workshop_test_payments p where p.booking_id=new.id and p.state='paid' and new.payment_status='paid' and new.amount_paid_cents=p.amount_cents) then raise exception 'Payment required' using errcode='23514';end if;
 if tg_op='UPDATE' and new.status is distinct from old.status and new.status='cancelled' and old.payment_status in ('pending','paid') and not exists(select 1 from public.naitea_workshop_test_payments p where p.booking_id=new.id and p.state in ('expired','failed')) then raise exception 'Resolve Stripe payment before cancellation' using errcode='23514';end if;
 return new;
end $$;
revoke all on function naitea_private.guard_test_payment_booking() from public,anon,authenticated;
create trigger naitea_guard_test_payment_booking before insert or update of status on public.naitea_bookings for each row execute function naitea_private.guard_test_payment_booking();
create function naitea_private.guard_test_payment_workshop() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and new.payment_mode='online' then
  if new.price_cents<50 or not exists(select 1 from public.naitea_stripe_test_accounts a where a.professional_id=new.professional_id) then raise exception 'Stripe test account and valid price required' using errcode='23514';end if;
 end if;
 if tg_op='UPDATE' then
  if new.payment_mode is distinct from old.payment_mode and exists(select 1 from public.naitea_bookings b where b.workshop_id=old.id and (b.status='confirmed' or (b.status='pending' and b.expires_at>now()))) then raise exception 'Active reservations exist' using errcode='23514';end if;
  if (new.status is distinct from old.status or new.professional_id is distinct from old.professional_id or new.starts_at is distinct from old.starts_at or new.price_cents is distinct from old.price_cents or new.pricing_unit is distinct from old.pricing_unit or new.payment_mode is distinct from old.payment_mode) and exists(select 1 from public.naitea_bookings b join public.naitea_workshop_test_payments p on p.booking_id=b.id where b.workshop_id=old.id and p.state in ('pending','paid')) then raise exception 'Resolve Stripe payments before modifying the workshop' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function naitea_private.guard_test_payment_workshop() from public,anon,authenticated;
create trigger naitea_guard_test_payment_workshop before insert or update of status,professional_id,starts_at,price_cents,pricing_unit,payment_mode on public.naitea_workshops for each row execute function naitea_private.guard_test_payment_workshop();
CREATE OR REPLACE FUNCTION naitea_private.read_published_workshop(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
'id',w.id,'title',w.title,'description',w.description,'starts_at',w.starts_at,'category',w.category,
'duration_label',w.duration_label,'timezone_name',w.timezone_name,'modality',w.modality,
'venue_name',case when w.modality='venue' then w.venue_name end,
'venue_street',case when w.modality='venue' then w.venue_street end,
'venue_postal_code',case when w.modality='venue' then w.venue_postal_code end,
'venue_city',case when w.modality='venue' then w.venue_city end,
'video_platform',case when w.modality='video' then w.video_platform end,
'capacity',w.capacity,'price_cents',w.price_cents,'pricing_unit',w.pricing_unit,'payment_mode',w.payment_mode,'target_audiences',w.target_audiences,
'child_age_min',w.child_age_min,'child_age_max',w.child_age_max,'child_age_unit',w.child_age_unit,
'business_name',nullif(btrim(p.business_name),''),
'slug',w.public_slug,
'public_email',case when p.public_details_enabled then p.public_email end,
'public_phone',case when p.public_details_enabled then p.public_phone end,
'public_website',case when p.public_details_enabled then p.public_website end,
'public_google_url',case when p.public_details_enabled then p.public_google_url end,
'google_rating',case when p.public_details_enabled and p.google_reviews_visible and p.public_google_url is not null then p.google_rating end,
'google_review_count',case when p.public_details_enabled and p.google_reviews_visible and p.public_google_url is not null then p.google_review_count end,
'google_reviews_updated_at',case when p.public_details_enabled and p.google_reviews_visible and p.public_google_url is not null then p.google_reviews_updated_at end,
'portrait_path',case when p.public_details_enabled and exists(select 1 from storage.objects o where o.bucket_id='naitea-professional-portraits' and o.name=w.professional_id::text||'/profile.jpg') then w.professional_id::text||'/profile.jpg' end,
'cover_path',case when exists(select 1 from storage.objects o where o.bucket_id='naitea-workshop-covers' and o.name=w.professional_id::text||'/'||w.id::text||'.jpg') then w.professional_id::text||'/'||w.id::text||'.jpg' end)
from public.naitea_workshops w left join public.naitea_profiles p on p.id=w.professional_id
where w.id=p_id and w.status='published'
$function$
;
create function public.naitea_prepare_workshop_checkout(p_workshop_id uuid,p_parent_email text,p_seats integer,p_request_key uuid,p_hash text,p_details jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.naitea_workshops%rowtype; b public.naitea_bookings%rowtype; acct text; r jsonb; expiry timestamptz; email text:=lower(btrim(p_parent_email)); amount integer;
begin
 if email is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_seats is null or p_seats not between 1 and 10 then return jsonb_build_object('code','INVALID_REQUEST');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-email:'||email,0));
 select * into w from public.naitea_workshops where id=p_workshop_id for update;
 if not found or w.status<>'published' or w.payment_mode<>'online' or w.starts_at<=now()+interval '40 minutes' then return jsonb_build_object('code','WORKSHOP_UNAVAILABLE');end if;
 select stripe_account_id into acct from public.naitea_stripe_test_accounts where professional_id=w.professional_id;
 if not found then return jsonb_build_object('code','STRIPE_NOT_CONNECTED');end if;
 amount:=w.price_cents*p_seats;
 if amount<50 then return jsonb_build_object('code','INVALID_AMOUNT');end if;
 r:=public.naitea_begin_full_booking(w.id,email,p_seats,p_request_key,p_hash,p_details);
 if r->>'code' is distinct from 'REQUEST_RECEIVED' then return r;end if;
 if r->>'send' is distinct from 'true' then return jsonb_build_object('code','ALREADY_REQUESTED');end if;
 select * into b from public.naitea_bookings where workshop_id=w.id and request_key=p_request_key and confirmation_hash=p_hash and status='pending' for update;
 if not found then raise exception 'Pending reservation missing';end if;
 expiry:=date_trunc('second',now()+interval '35 minutes');
 insert into public.naitea_workshop_test_payments(booking_id,stripe_account_id,return_hash,amount_cents,checkout_expires_at) values(b.id,acct,p_hash,amount,expiry);
 -- Hold until Stripe proves a terminal state; never expire a paid session locally while a webhook is delayed.
 update public.naitea_bookings set confirmation_hash=null,expires_at='infinity',payment_status='pending' where id=b.id;
 return jsonb_build_object('code','HELD','booking_id',b.id,'account',acct,'amount_cents',amount,'unit_cents',w.price_cents,'seats',b.seats,'title',w.title,'expires_at',extract(epoch from expiry)::bigint);
end $$;
create function public.naitea_bind_workshop_checkout(p_booking_id uuid,p_account text,p_session text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.naitea_workshop_test_payments set session_id=p_session where booking_id=p_booking_id and stripe_account_id=p_account and state='pending' and (session_id is null or session_id=p_session);
 return found;
end $$;
create function public.naitea_get_workshop_checkout(p_booking_id uuid,p_account text) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('session_id',p.session_id,'account',p.stripe_account_id,'amount_cents',p.amount_cents,'state',p.state,'currency',p.currency) from public.naitea_workshop_test_payments p where p.booking_id=p_booking_id and p.stripe_account_id=p_account
$$;
create function public.naitea_settle_workshop_checkout(p_booking_id uuid,p_account text,p_session text,p_amount integer,p_currency text,p_outcome text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare wid uuid; w public.naitea_workshops%rowtype; b public.naitea_bookings%rowtype; p public.naitea_workshop_test_payments%rowtype; used integer;
begin
 if p_outcome is null or p_outcome not in ('paid','expired','failed') or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' then return jsonb_build_object('code','INVALID');end if;
 select workshop_id into wid from public.naitea_bookings where id=p_booking_id;
 if not found then return jsonb_build_object('code','UNKNOWN');end if;
 select * into w from public.naitea_workshops where id=wid for update;
 select * into b from public.naitea_bookings where id=p_booking_id for update;
 select * into p from public.naitea_workshop_test_payments where booking_id=b.id for update;
 if not found or p.stripe_account_id is distinct from p_account or (p.session_id is not null and p.session_id is distinct from p_session) or p.amount_cents is distinct from p_amount or p.currency is distinct from p_currency then return jsonb_build_object('code','MISMATCH');end if;
 if p.state=p_outcome then return jsonb_build_object('code','ALREADY_SETTLED');end if;
 if p.state<>'pending' or b.status<>'pending' then return jsonb_build_object('code','CONFLICT');end if;
 if p_outcome='paid' then
  select coalesce(sum(seats),0) into used from public.naitea_bookings where workshop_id=wid and id<>b.id and (status='confirmed' or (status='pending' and expires_at>now()));
  if w.status<>'published' or w.payment_mode<>'online' or used+b.seats>w.capacity then return jsonb_build_object('code','CONFLICT');end if;
  update public.naitea_workshop_test_payments set state='paid',session_id=p_session,settled_at=now(),mail_claimed_at=now() where booking_id=b.id;
  update public.naitea_bookings set status='confirmed',confirmed_at=now(),confirmation_mode='instant',payment_status='paid',amount_paid_cents=p.amount_cents,expires_at=null where id=b.id;
  return jsonb_build_object('code','CONFIRMED','email',b.parent_email,'first_name',b.parent_first_name,'seats',b.seats,'workshop',naitea_private.read_published_workshop(w.id),'amount_cents',p.amount_cents);
 end if;
 update public.naitea_workshop_test_payments set state=p_outcome,session_id=p_session,settled_at=now() where booking_id=b.id;
 update public.naitea_bookings set status='cancelled',payment_status=p_outcome,expires_at=now() where id=b.id;
 return jsonb_build_object('code','RELEASED');
end $$;
create function public.naitea_workshop_checkout_return(p_hash text) returns text language sql stable security invoker set search_path='' as $$
select state from public.naitea_workshop_test_payments where return_hash=p_hash
$$;
revoke all on function public.naitea_prepare_workshop_checkout(uuid,text,integer,uuid,text,jsonb), public.naitea_bind_workshop_checkout(uuid,text,text), public.naitea_get_workshop_checkout(uuid,text), public.naitea_settle_workshop_checkout(uuid,text,text,integer,text,text), public.naitea_workshop_checkout_return(text) from public,anon,authenticated;
grant execute on function public.naitea_prepare_workshop_checkout(uuid,text,integer,uuid,text,jsonb), public.naitea_bind_workshop_checkout(uuid,text,text), public.naitea_get_workshop_checkout(uuid,text), public.naitea_settle_workshop_checkout(uuid,text,text,integer,text,text), public.naitea_workshop_checkout_return(text) to service_role;
-- Keep existing publication lock until the Worker and signing secret are verified.
