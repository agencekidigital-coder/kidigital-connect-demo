-- Open one existing, eligible online-payment draft for a controlled test only.
-- Keep all other online modes and workshops blocked at database level.
do $$
declare eligible_count integer; wid uuid; pro uuid;
begin
 select count(*) into eligible_count from public.naitea_workshops w where w.status='draft' and w.payment_mode='online' and w.price_cents>=50 and w.starts_at>now()+interval '40 minutes' and exists(select 1 from public.naitea_stripe_test_accounts a where a.professional_id=w.professional_id);
 if eligible_count<>1 then raise exception 'Exactly one eligible online test draft required'; end if;
 select w.id,w.professional_id into strict wid,pro from public.naitea_workshops w where w.status='draft' and w.payment_mode='online' and w.price_cents>=50 and w.starts_at>now()+interval '40 minutes' and exists(select 1 from public.naitea_stripe_test_accounts a where a.professional_id=w.professional_id);
 execute format('alter table public.naitea_workshops add constraint naitea_workshop_test_publication_scope check (status <> ''published'' or payment_mode in (''onsite'',''free'') or (payment_mode=''online'' and id=%L::uuid and professional_id=%L::uuid and price_cents>=50))',wid,pro);
 alter table public.naitea_workshops drop constraint naitea_workshop_online_payment_not_yet_active;
end $$;
