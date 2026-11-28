-- Extend the existing controlled pilot to the two verified test drafts only.
do $$
declare original_id uuid; pilot_owner uuid; choice_id uuid; deposit_id uuid;
begin
 select distinct w.id,w.professional_id into strict original_id,pilot_owner
 from public.naitea_workshops w join public.naitea_bookings b on b.workshop_id=w.id join public.naitea_workshop_test_payments p on p.booking_id=b.id
 where w.status='published' and w.payment_mode='online' and w.title='Réflexologie plantaire' and w.price_cents=2500 and p.state='paid' and b.status='confirmed' and p.amount_cents=2500;
 select w.id into strict choice_id from public.naitea_workshops w where w.professional_id=pilot_owner and w.title='Massage bébé' and w.status='draft' and w.payment_mode='choice' and w.price_cents=1000 and w.starts_at>now()+interval '40 minutes';
 select w.id into strict deposit_id from public.naitea_workshops w where w.professional_id=pilot_owner and w.title='Bain enveloppé' and w.status='draft' and w.payment_mode='deposit' and w.price_cents=5000 and w.deposit_cents=1500 and w.starts_at>now()+interval '40 minutes';
 if not exists(select 1 from public.naitea_stripe_test_accounts a where a.professional_id=pilot_owner) then raise exception 'Missing Stripe test account';end if;
 execute format('alter table public.naitea_workshops add constraint naitea_workshop_test_publication_scope_v2 check (status <> ''published'' or payment_mode in (''onsite'',''free'') or (professional_id=%L::uuid and ((payment_mode=''online'' and id=%L::uuid and price_cents>=50) or (payment_mode=''choice'' and id=%L::uuid and price_cents>=50) or (payment_mode=''deposit'' and id=%L::uuid and deposit_cents>=50 and deposit_cents<price_cents))))',pilot_owner,original_id,choice_id,deposit_id);
 alter table public.naitea_workshops drop constraint naitea_workshop_test_publication_scope;
end $$;
