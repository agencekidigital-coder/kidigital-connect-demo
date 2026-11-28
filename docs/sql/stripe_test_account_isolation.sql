-- Already applied in beta. No live account or payment information is modified.
create table if not exists public.naitea_stripe_test_accounts (
 professional_id uuid primary key references auth.users(id) on delete cascade,
 stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
alter table public.naitea_stripe_test_accounts enable row level security;
revoke all on public.naitea_stripe_test_accounts from public,anon,authenticated;
grant select,insert on public.naitea_stripe_test_accounts to service_role;
