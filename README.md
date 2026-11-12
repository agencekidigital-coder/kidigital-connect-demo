# Kidigital Connect — Démo V8

Démo statique autonome de Kidigital Connect. `index.html` est le point d'entrée du site.

## Publication sur GitHub et Vercel

1. Créer un dépôt GitHub privé, par exemple `kidigital-connect-demo`.
2. Dans le dépôt, cliquer sur **Add file → Upload files** et importer `index.html` à la racine, puis valider avec **Commit changes**.
3. Dans Vercel, cliquer sur **Add New → Project**, importer le dépôt GitHub et choisir le framework **Other** (ou aucune détection), avec le répertoire racine `./`. Laisser la commande de build vide.
4. Cliquer sur **Deploy**. Vercel fournit une URL de type `*.vercel.app`.

## Limites de la démo

- Pas de serveur, base de données ni comptes réels.
- Les données enregistrées dans le navigateur (localStorage) ne sont pas partagées entre appareils ou utilisateurs.
- Les services IA, emails, paiements, publications et réservations réelles ne sont pas connectés.
- Ne pas saisir de données réelles de familles ou d'enfants.
- Ne pas confondre dépôt GitHub privé et site web privé : l'URL déployée peut être accessible à des tiers. Activer la protection d'accès Vercel si nécessaire, selon le plan.
- Les polices Google Fonts nécessitent une connexion Internet.

## Authentification Supabase (branche de test)

Cette branche ajoute, sans remplacer la démo V8 :
- connexion.html : création de compte, connexion e-mail/mot de passe et déconnexion.
- api/public-config.js : fonction Vercel exposant uniquement SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY (valeurs publiques).
- supabase/02-auth-profile-trigger.sql : création automatique du profil après inscription Supabase Auth.
- Un lien « Connexion (test) » dans la démo existante.

### Avant de tester

1. Dans Supabase > SQL Editor, exécuter supabase/02-auth-profile-trigger.sql. Vérifier que les quatre tables ont rls_enabled = true.
2. Dans Supabase > Authentication > URL Configuration, conserver https://kidigital-connect-demo.vercel.app comme Site URL, et ajouter https://kidigital-connect-demo.vercel.app/connexion.html dans Redirect URLs.
3. Vérifier SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sur Vercel, pour Production et Preview. Ne jamais placer de clé secrète dans une page HTML ou une API publique.
4. Après revue et fusion de la PR, déployer et tester /connexion.html avec un compte de test. Pour une URL Vercel Preview, ajouter son adresse de redirection exacte à Supabase.

### Limites de cette étape

- La connexion Supabase est indépendante de la démo : index.html reste accessible et les données sont toujours dans localStorage.
- Les ateliers, familles, réservations et paiements ne sont pas encore synchronisés avec Supabase.
- Aucun compte Stripe n'est connecté et aucun paiement réel n'est possible.
- L'envoi d'e-mails Supabase par défaut est limité ; prévoir SMTP et protections anti-abus avant une ouverture publique.
- Les politiques RLS de réservation ne permettent que la consultation par la professionnelle ; les écritures Stripe et les réservations devront être gérées côté serveur avec vérification d'autorisation.
- Ne pas saisir de vraies données de familles ou d'enfants.
