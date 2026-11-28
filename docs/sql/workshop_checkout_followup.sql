CREATE OR REPLACE FUNCTION public.naitea_abort_unstarted_workshop_checkout(p_booking_id uuid, p_account text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare wid uuid;
begin
 select workshop_id into wid from public.naitea_bookings where id=p_booking_id;
 if not found then return false;end if;
 perform 1 from public.naitea_workshops where id=wid for update;
 perform 1 from public.naitea_bookings where id=p_booking_id and status='pending' for update;
 if not found then return false;end if;
 update public.naitea_workshop_test_payments set state='failed',settled_at=now() where booking_id=p_booking_id and stripe_account_id=p_account and state='pending' and session_id is null;
 if not found then return false;end if;
 update public.naitea_bookings set status='cancelled',payment_status='failed',expires_at=now() where id=p_booking_id;
 return true;
end $function$
;
revoke all on function public.naitea_abort_unstarted_workshop_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.naitea_abort_unstarted_workshop_checkout(uuid,text) to service_role;
grant execute on function naitea_private.read_published_workshop(uuid) to service_role;
