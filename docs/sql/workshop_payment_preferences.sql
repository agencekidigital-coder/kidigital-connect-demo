-- Applied to Naïtéa beta Supabase. Existing workshops retain payment on site.
alter table public.naitea_workshops add column if not exists payment_mode text not null default 'onsite',add column if not exists deposit_cents integer;
alter table public.naitea_workshops add constraint naitea_workshop_payment_mode_check check (
 (payment_mode='onsite' and deposit_cents is null)
 or (payment_mode='free' and price_cents=0 and deposit_cents is null)
 or (payment_mode in ('online','choice') and price_cents>0 and deposit_cents is null)
 or (payment_mode='deposit' and deposit_cents is not null and deposit_cents>0 and deposit_cents<price_cents)
);
alter table public.naitea_workshops add constraint naitea_workshop_online_payment_not_yet_active check (status<>'published' or payment_mode in ('onsite','free'));
