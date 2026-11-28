-- Authorize one verified draft for integral payment in the sandbox only.
do $$
begin
 if not exists(select 1 from public.naitea_services s join public.naitea_stripe_test_accounts a on a.professional_id=s.professional_id where s.id='165ad658-3a45-4d7b-b8c4-64365312c248' and s.professional_id='529cf1d1-5add-42c3-9b97-31b3b8801693' and s.status='draft' and s.payment_mode='online' and s.price_cents=5000 and s.booking_link is null) then raise exception 'Pilot draft not verified';end if;
 alter table public.naitea_services add constraint naitea_service_payment_pilot_scope_v2 check(status<>'active' or payment_mode in ('onsite','free') or (id='165ad658-3a45-4d7b-b8c4-64365312c248'::uuid and professional_id='529cf1d1-5add-42c3-9b97-31b3b8801693'::uuid and payment_mode='online' and price_cents>=50));
 alter table public.naitea_services drop constraint naitea_service_payment_pilot_scope;
end $$;