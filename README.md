# Naïtéa — démonstration professionnelle et familles

Application de démonstration Naïtea, espace professionnel et parcours familles. Les données métier restent locales au navigateur ; l’identification utilise Supabase.

## Prévisualisation et points d’entrée

Le dépôt est déjà connecté à Vercel. Les changements sont publiés sur la branche `feature/naitea-supabase-auth-foundation` et déployés en aperçu. Ne pas fusionner ni déployer en production sans accord explicite.

- `/decouvrir` : landing professionnelle.
- `/connexion.html` : inscription, connexion et récupération du mot de passe.
- `/bienvenue.html` : accueil avec tutoriel après vérification du compte.
- `/pro` : nouvel espace de démonstration professionnel.
- `/familles` : aperçu de la fiche publique et des réservations.
- `/` : point d’entrée historique de la démonstration.

## Limites de la démo

- L’authentification est réelle, mais les données métier dans localStorage ne sont pas synchronisées entre appareils ni isolées par un backend métier multi-comptes.
- Les réservations, factures, emails de réservation et paiements restent fictifs ou simulés. Ne pas saisir de données réelles de familles ou d’enfants.
- Google, Meta et l’IA distante ne sont pas configurés. Le partage social natif et l’import de statistiques CSV ne sont pas une publication ou une synchronisation API.
- Une URL de prévisualisation peut être publique. Les routes `/pro` et `/familles` ne constituent pas une protection serveur.
- Les polices de marque sont hébergées sur Naïtea ; le catalogue complémentaire utilise le service de polices du projet.

## Authentification Supabase (branche de test)

Cette branche conserve la fondation d’authentification et enrichit l’interface actuelle :
- connexion.html : création de compte, connexion e-mail/mot de passe et déconnexion.
- api/public-config.js : fonction Vercel exposant uniquement SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY (valeurs publiques).
- supabase/02-auth-profile-trigger.sql : création automatique du profil après inscription Supabase Auth.
- Un lien « Connexion (test) » dans la démo existante.

### Avant de tester

1. Les scripts SQL sont historiques : ne pas les réexécuter pour cette passe d’interface. Vérifier les politiques et l’isolation avant une future ouverture à des données réelles.
2. La configuration historiquement documentée utilisait https://kidigital-connect-demo.vercel.app comme Site URL et https://kidigital-connect-demo.vercel.app/connexion.html dans Redirect URLs. Vérifier les valeurs effectives dans Authentication → URL Configuration. Autoriser le callback exact d’un aperçu stable dans le cadre de la configuration bêta ; ne pas remplacer l’adresse de production pour réparer un aperçu.
3. Vérifier SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sur Vercel, pour Production et Preview. Ne jamais placer de clé secrète dans une page HTML ou une API publique.
4. Tester d’abord les parcours dans l’aperçu de branche. Les tests automatiques substituent le SDK et ne créent aucun compte réel. Aucun changement Supabase ou déploiement de production n’est réalisé par cette livraison.

### Limites de cette étape

- La connexion Supabase est indépendante de la démo : index.html reste accessible et les données sont toujours dans localStorage.
- Les ateliers, familles, réservations et paiements ne sont pas encore synchronisés avec Supabase.
- Aucun compte Stripe n'est connecté et aucun paiement réel n'est possible.
- L'envoi d'e-mails Supabase par défaut est limité ; prévoir SMTP et protections anti-abus avant une ouverture publique.
- Les politiques RLS de réservation ne permettent que la consultation par la professionnelle ; les écritures Stripe et les réservations devront être gérées côté serveur avec vérification d'autorisation.
- Ne pas saisir de vraies données de familles ou d'enfants.

## Suivi de Naïtéa

La branche `feature/naitea-supabase-auth-foundation` contient la refonte Naïtéa et les parcours professionnels/familles de démonstration. Les décisions et demandes sont conservées dans [la mémoire du projet](docs/NAITEA-MEMOIRE-PROJET.md). Voir aussi [les ajustements du 17 novembre](docs/naitea-refinements-v9.md). Aucun envoi email, paiement ou publication sociale automatique n’est activé.

Les [ajustements du 18 novembre](docs/naitea-refinements-v10.md) ajoutent les filtres familles, le profil réactif, le catalogue de polices corrigé, les imports transparents, les modèles, l’historique et la charte graphique. La synchronisation des avis Google est préparée et nécessite encore une configuration Places API autorisée.

Les [ajustements du 19 novembre](docs/naitea-refinements-v11.md) ajoutent la mise en forme d’une sélection de texte, le cadrage des images, le copier-coller, les informations d’événement actualisées, le partage JPEG, les modalités détaillées, les horaires publics et le filtre par date d’atelier.

L’[audit Materneo du 20 novembre](docs/naitea-materneo-benchmark.md) compare les fonctionnalités publiques et précise le positionnement de Naïtéa. Cette passe enrichit les fiches professionnelles : spécialités, publics, langues, formations déclarées, galerie, FAQ, informations pratiques, filtre des accompagnements, favoris et contact de démonstration. L’URL `/?vue=parents` ouvre directement cet aperçu.

La [passe Berceau](docs/naitea-berceau-workflows.md) applique les fichiers officiels de marque, fixe les menus, ajoute les bons cadeaux locaux et leurs usages partiels, les rappels email/SMS de démonstration et l’ajout manuel à Google Agenda ou l’export ICS. Les mots clés et formations de la fiche disposent de sélecteurs et champs structurés. L’assistant d’avis prépare des réponses locales ; son adaptateur IA authentifié reste désactivé. Aucun envoi, débit ou synchronisation Google automatique n’est activé.

La [facturation de démonstration](docs/naitea-billing-demo.md) prépare un PDF et son email après un nouvel achat simulé, distingue les règlements sur place et les justificatifs de bons cadeaux, conserve les documents et propose un avoir intégral. Tous les documents restent locaux, sans valeur fiscale ni envoi réel.

La [nouvelle passe plateforme](docs/naitea-platform-v12.md) ajoute les pictogrammes transparents réservés à l’interface, les bons personnalisables et intégrables, les coordonnées et modalités de réservation, le catalogue d’ateliers documenté, le chatbot et le raccordement OAuth Google. Les [factures de bons cadeaux](docs/naitea-invoices.md) disposent d’un modèle structuré et de règles distinctes selon leur traitement de TVA. L’activation réelle de Google et des services externes reste conditionnée à des accès autorisés ; les achats et documents de la démo restent fictifs.

La [landing professionnelle](docs/naitea-landing.md), accessible sur `/decouvrir`, présente l’offre avec la charte Berceau et mène directement à la création d’un compte de test. Le référencement est préparé côté serveur ; les prévisualisations restent exclues de l’indexation. La racine conserve la démonstration existante.

La mise à jour du 21 novembre ajoute la hero centrée sur le produit, deux vidéos Pro/Familles, l’avant/avec Naïtea, la présentation de Laureen, la FAQ ouverte et les tarifs validés (fiche gratuite, Complet à 14,90 € TTC/mois, lancement à 9,90 € pour les 50 premières pendant 12 mois, essai de 30 jours). Les exemples de témoignages sont indiqués fictifs et exclus du rendu en production. Aucun abonnement ni prélèvement réel n’est activé.

La dernière passe de la landing ajoute un résumé lisible par les IA dans le HTML initial, un titre sur trois lignes maximum et six grands encarts avec captures agrandissables, alternant texte et image sur ordinateur. Les espaces et marges sont augmentés, avec la charte Berceau conservée. Les tests de navigateur couvrent de 320 à 1920 px et la lecture du résumé sans JavaScript.

La [préparation des testeuses](docs/naitea-tester-onboarding.md) ajoute l’accueil avec tutoriel, les routes explicites et le diagnostic des retours d’email vers l’ancienne production. Le [studio](docs/naitea-editor-v14.md) corrige les tailles et ajoute multisélection, poignées latérales, puces, effets et SVG libres. Le [profil et son assistant](docs/naitea-public-assistant.md) intègrent réseaux, politique facultative et conversation locale contextualisée. Les [statistiques sociales](docs/naitea-social-statistics.md) reposent sur des exports réellement importés. Les [prérequis de bêta connectée](docs/naitea-beta-readiness.md) distinguent ce qui est livré des connexions et contrôles serveur restant à construire.
