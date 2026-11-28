-- Naïtéa / étape authentification
-- À exécuter UNE FOIS dans Supabase > SQL Editor avant de tester l'inscription.
-- Les quatre tables et leurs politiques RLS ont déjà été créées à l'étape précédente.
-- Ce script ne supprime aucune table et n'ouvre pas de données aux utilisateurs anonymes.

-- Créer un profil lorsque Supabase Auth crée un utilisateur.
-- La fonction s'exécute côté base de données avec les privilèges du propriétaire.
create or replace function public.naitea_create_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.naitea_profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists naitea_auth_profile_created on auth.users;
create trigger naitea_auth_profile_created
after insert on auth.users
for each row execute function public.naitea_create_profile_on_signup();

-- Rattrapage pour les comptes Auth éventuellement déjà créés.
insert into public.naitea_profiles (id, full_name)
select
  id,
  nullif(trim(coalesce(raw_user_meta_data ->> 'full_name', '')), '')
from auth.users
on conflict (id) do nothing;

-- Contrôle : ces quatre tables doivent toutes avoir RLS activé.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'naitea_profiles', 'naitea_workshops',
    'naitea_bookings', 'naitea_stripe_accounts'
  )
order by relname;
