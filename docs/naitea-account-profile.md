# Compte professionnel : préparation du premier enregistrement serveur

24 novembre 2026. Branche `feature/naitea-supabase-auth-foundation`. Aucun script de modification, appel d’authentification réel ou changement de configuration Supabase/Stripe exécuté pendant cette étape.

## Résultat de l’audit reçu

La fondatrice a transmis le JSON produit par `supabase/03-beta-audit-readonly.sql`. Il décrit les métadonnées, sans lignes de comptes ou de familles.

- Les quatre tables existent et ont RLS activé. `rls_forced=false` ne désactive pas RLS pour les rôles ordinaires `anon` et `authenticated` ; ce n’est pas en soi une anomalie.
- `naitea_profiles` permet SELECT et UPDATE à l’utilisateur authentifié dont l’identifiant correspond à la ligne. Le contrôle après UPDATE conserve cette restriction. Colonnes disponibles : `id`, `full_name`, `business_name`, `created_at`. Aucune politique INSERT n’est visible.
- `naitea_workshops` a des règles de propriétaire pour les quatre opérations. Les réservations et comptes Stripe n’ont que des règles de lecture, liées au propriétaire.
- Les contraintes vérifient notamment capacités positives, montants positifs ou nuls et statuts autorisés. Elles ne suffisent pas à empêcher deux réservations concurrentes de dépasser une capacité.
- Cet export ne couvre ni les GRANT, ni le déclencheur sur `auth.users`, ni toutes les vues et fonctions. Sa liste vide de triggers concerne les tables publiques ciblées ; elle ne prouve pas l’absence du déclencheur d’inscription.

Il s’agit d’un contrôle de métadonnées, pas d’une validation des accès réels entre deux comptes.

## Incrément préparé et inactif

Cloudflare expose `/compte` et `/compte.html`. La page est distincte de la fiche publique fictive. Elle ne copie jamais son contenu dans le stockage local commun de la démonstration. Le SDK Supabase conserve sa session selon son fonctionnement habituel ; les champs du profil restent dans la page.

`/api/account` autorise GET, HEAD et PATCH sur **les deux champs existants** `full_name` et `business_name`. Il faut les deux variables `NAITEA_AUTH_ENABLED=true` et `NAITEA_PROFILE_ENABLED=true`, ainsi qu’une URL de projet et une clé publique valides. Les deux variables restent **false** dans le dépôt. Ajouter des clés sans activer les deux variables n’ouvre pas cette API.

Le serveur vérifie le jeton auprès de Supabase Auth. Il choisit l’identifiant renvoyé par ce service, puis utilise le même jeton utilisateur pour lire ou modifier la ligne avec RLS. Il n’accepte aucun identifiant de compte, rôle, email ou autre champ dans le PATCH. Il n’utilise ni clé privilégiée, ni INSERT, ni upsert. Un profil absent renvoie 404 et doit être diagnostiqué avant activation, sans création silencieuse par ce serveur.

PATCH impose une origine identique, JSON et un corps limité à 2048 octets réellement lus. Les noms sont normalisés et bornés. Les réponses du fournisseur sont elles aussi bornées avant analyse. Les retours d’erreur ne reproduisent pas les réponses SQL ou les jetons ; les réponses API sont `private, no-store`.

Ces règles ne remplacent pas les contraintes et droits de la base : un utilisateur peut appeler directement l’API Supabase avec sa session et les permissions effectives. Le contrôle RLS et les GRANT restent indispensables.

La page efface immédiatement ses champs lors d’un changement de session ou d’une déconnexion. Les opérations précédentes sont annulées et leurs réponses ignorées. Le renouvellement d’un jeton pour le même compte préserve une saisie en cours. Une sauvegarde sans confirmation ne déclenche pas de nouvelle écriture automatique. La page ne prétend pas réussir une déconnexion en échec.

## Prochaine action dans Supabase : lecture seule

Exécuter uniquement [04-auth-profile-audit-readonly.sql](../supabase/04-auth-profile-audit-readonly.sql) dans **SQL Editor → New query**, puis transmettre la cellule JSON `profile_readiness`.

Cette seule requête SELECT examine les privilèges effectifs des rôles publics, les droits des trois colonnes utiles et les métadonnées du déclencheur sur `auth.users`. Elle ne lit aucune ligne utilisateur, n’exporte aucun corps ou argument de fonction et ne modifie aucun réglage. Ne pas relancer le script historique `02-auth-profile-trigger.sql`.

Après lecture du résultat, vérifier les URL de confirmation/récupération exactes et le SMTP dans le projet existant, puis préparer toute correction nécessaire avec un retour arrière avant application. Les deux flags ne seront ouverts qu’après validation de cette configuration et autorisation de l’étape de test réelle. Tester ensuite avec deux comptes fictifs distincts : lecture/écriture de son profil, refus d’accès direct au profil de l’autre, persistance après rechargement et sur un second appareil, connexion et déconnexion.

La sauvegarde des ateliers, familles et réservations, les paiements, les factures réelles et le back-office restent hors de cet incrément. Le domaine `naitea.fr` et les DNS email ne sont pas modifiés.

## Vérification

Les tests du handler simulent entièrement Supabase. Ils couvrent propriétaire A/B vérifié au serveur, jeton aux claims falsifiés, champs interdits, origines, limites des flux, redirections, erreurs et profil manquant. Ils ne prouvent pas le fonctionnement des règles distantes.

`node tests/browser-account-profile.cjs` utilise uniquement le serveur local et des fixtures pour le SDK et l’API. Il vérifie les formats 1440, 390 et 320 px, les changements de compte pendant une opération, les erreurs et l’absence d’écriture dans l’état de démonstration. Aucun compte, email ou enregistrement réel n’est créé.

Validation de cette version : 124 tests unitaires réussis et compilation Wrangler `--dry-run` réussie, sans upload. Les tests navigateur du runtime local couvrent aussi la landing, les espaces pro/familles et les routes fermées en 1440 et 390 px.
