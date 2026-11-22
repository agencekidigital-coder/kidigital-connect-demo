# Parcours de démarrage des testeuses

## Parcours livré

Depuis la présentation `/decouvrir`, le choix d’une offre ouvre `/connexion.html`. Après une inscription qui nécessite une confirmation, la page indique l’adresse saisie, les étapes à suivre et propose d’explorer la démonstration publique en attendant.

Après une connexion ou un retour de confirmation reconnu par Supabase, `auth.getUser()` valide l’utilisateur auprès du fournisseur. La page redirige sur la même origine vers `/bienvenue.html`. Cet accueil propose la vidéo tutorielle avec voix et sous-titres français, puis deux accès explicites : `/pro` pour le nouvel espace professionnel et `/familles` pour le parcours public des familles.

La récupération de mot de passe reste sur `/connexion.html` : l’état de récupération est distinct de la connexion ordinaire et ne redirige pas vers l’accueil avant le changement de mot de passe. Le formulaire vérifie l’utilisateur auprès de Supabase avant de permettre la modification.

Le choix `fiche` ou `complet` est conservé dans une préférence locale limitée à sept jours pour retrouver le parcours après un email de confirmation. Cette préférence contient uniquement l’offre et sa date. Elle n’active aucun abonnement, paiement, droit d’accès ou période d’essai facturée. Sur un autre navigateur, l’offre peut être resélectionnée depuis la présentation.

## Retour vers une ancienne version : ce qui est établi

Avant la correction, le lien de la section de compte connecté pointait vers `/`. Il n’offrait aucun parcours de démarrage ni accès explicite au nouvel espace pro. Ce lien renvoie désormais vers le nouvel accueil, qui dirige vers `/pro` et `/familles`.

Les appels existants d’inscription et de récupération utilisaient déjà l’origine de la page ouverte, suivie de `/connexion.html`. La correction conserve ce callback exact. Elle ne force ni l’ancien domaine de production ni un domaine de prévisualisation particulier dans le code. Aucun paramètre `next` fourni dans une URL ne peut choisir une destination externe.

Le README du dépôt documente encore `https://kidigital-connect-demo.vercel.app` comme **Site URL** Supabase et `https://kidigital-connect-demo.vercel.app/connexion.html` dans **Redirect URLs**. Il rappelle aussi que chaque prévisualisation doit avoir son URL de retour autorisée. Cela constitue une cause plausible du retour vers une ancienne production : lorsqu’une destination demandée n’est pas autorisée, Supabase peut utiliser la Site URL configurée. **Les réglages effectifs du projet Supabase et le contenu d’un vrai email de confirmation n’ont pas été consultés ni modifiés dans cette passe. Cette hypothèse n’est donc pas présentée comme une cause confirmée.**

## Vérifier la configuration sans créer de compte ni envoyer d’email

1. Dans le projet Supabase concerné, ouvrir **Authentication → URL Configuration**. Relever le domaine de **Site URL** et la liste **Redirect URLs**, sans recopier de clé ou de jeton.
2. Comparer cette liste avec l’origine exacte de l’aperçu réellement partagé aux testeuses, suivie de `/connexion.html`. Le code transmet cette origine courante, aussi bien pour `emailRedirectTo` que pour `resetPasswordForEmail.redirectTo`.
3. Si un email de confirmation existant est déjà disponible, inspecter la destination de son lien sans le publier. Vérifier sa valeur `redirect_to` et le domaine d’arrivée. Masquer les paramètres contenant des jetons dans toute capture. Il n’est pas nécessaire de déclencher un nouvel email pour cet audit.
4. Vérifier les modèles d’emails d’authentification : le bouton doit utiliser le lien de confirmation généré par Supabase, tel que `{{ .ConfirmationURL }}`, plutôt qu’une ancienne URL codée en dur. Le modèle de récupération doit conserver le lien et le type de récupération.
5. Pour une campagne de test, choisir un aperçu stable et ajouter son callback exact à la liste autorisée dans le cadre d’une intervention de configuration explicitement autorisée. Un changement de domaine d’aperçu nécessite de revérifier cette liste. Éviter un wildcard couvrant tous les domaines Vercel.

Ne pas remplacer la Site URL de production pour réparer un seul aperçu. Une migration du domaine de production et une modification des réglages Supabase restent des interventions distinctes. Aucune de ces modifications n’est incluse ici.

## Limites de cette démonstration

L’accueil vérifie une session avec `getUser()` ; il ne considère aucun drapeau `localStorage` comme une preuve d’identité. La page d’accueil est une aide au démarrage et non une frontière de sécurité serveur. `/pro` et `/familles` restent les routes de démonstration publique. Les exemples métiers sont fictifs et les modifications métier restent dans le navigateur ; il n’existe pas encore de synchronisation multi-comptes entre cet espace de test et les données d’un compte Supabase.

Les paiements et les emails de réservation sont simulés. Les emails d’authentification, lorsqu’une vraie inscription est effectuée par une testeuse, sont traités par Supabase existant. La livraison n’envoie aucun message pour vérifier ce parcours.

## Vérifications reproductibles

```sh
node --test tests/tester-onboarding.test.cjs
node tests/serve-demo.cjs
```

Dans un autre terminal :

```sh
BASE_URL=http://127.0.0.1:4182 node tests/browser-onboarding.cjs
```

Le navigateur substitue entièrement le SDK Supabase et `/api/public-config` avec des fixtures locales. Il couvre inscription en attente, connexion, callback déjà authentifié, conservation de l’offre, inscription avec session immédiate, récupération de mot de passe valide/expirée, déconnexion et erreur de service. Aucun compte réel ni email n’est créé ; aucun appel vers le faux fournisseur d’authentification n’est autorisé. Un faux drapeau de session local ne permet pas d’afficher le contenu connecté.

Le même scénario vérifie la lecture effective de la vidéo et de son audio, les sous-titres français actifs et l’absence de débordement à 1440, 390 et 320 pixels. Les captures et le rapport sont enregistrés dans `/workspace/artifacts/naitea-onboarding/`. Le test de configuration Supabase réelle et de délivrabilité des emails reste distinct de ces fixtures.

## URL stable de la branche de test

Alias Vercel confirmé : `https://kidigital-connect-demo-git-feature-naitea-sup-193988-montoitpro.vercel.app`. Les nouveaux aperçus de cette branche utilisent cet alias. Pour éviter de changer de callback à chaque commit, partager cet alias pendant les tests et vérifier l’autorisation exacte de `https://kidigital-connect-demo-git-feature-naitea-sup-193988-montoitpro.vercel.app/connexion.html` dans Redirect URLs Supabase. Cette URL est une valeur à configurer, pas une confirmation que l’allowlist a été modifiée. Ne pas autoriser tous les domaines Vercel.

Après achat et raccordement autorisé du domaine, un sous-domaine `beta.naitea.fr` pourra remplacer cet alias. Les domaines et les réglages Supabase n’ont pas été modifiés.
