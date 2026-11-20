# Landing professionnelle Naïtea

20 novembre 2026. Branche `feature/naitea-supabase-auth-foundation` uniquement.

La page `/decouvrir` présente Naïtea aux professionnelles et professionnels de la périnatalité, de la parentalité et de la petite enfance. Le choix de l’utilisatrice pour la conversion principale est **Créer un compte professionnel**. Tous les boutons ouvrent `/connexion.html?mode=signup&from=landing`, directement en mode inscription. L’accès secondaire ouvre la démonstration existante ; la page familles conserve son URL `/?vue=parents`.

## Contenu et identité

Premier écran explicite, six fonctionnalités, trois captures réelles accessibles par onglets et agrandissement, trois publics, étapes, questions et inscription. Aucun prix, nombre de clientes, témoignage, avis ou délai inventé. Les réservations, paiements et emails de réservation sont présentés comme simulés. La création de compte reste la fondation d’authentification existante ; elle ne synchronise pas encore les données de la démonstration.

Charte Berceau actuelle : pourpre `#590425`, corail `#BF5B45`, moutarde `#D89328`, ivoire `#FEF8ED`, Naitea Titres SemiBold et Source Sans 3 du kit officiel. Logo et pictogrammes transparents. Photos d’illustration hébergées localement, sans chargement tiers. Sources et licences : `assets/landing/SOURCES.md`. Les illustrations officielles ne sont toujours pas proposées dans la photothèque des pros.

Le menu reste visible au défilement. La navigation mobile, les onglets au clavier, les dialogues natifs, les liens d’évitement et la préférence de réduction des animations sont pris en compte. Le bouton d’inscription mobile apparaît quand les boutons du premier et du dernier écran sont hors champ.

## Rendu et référencement

`api/landing.js` rend `marketing/landing.html` côté serveur. Le HTML initial contient le titre, la description, le canonique, les métadonnées Open Graph/Twitter et les données structurées Organization/WebPage/WebApplication. Aucun avis ou prix fictif dans le schema.

`/robots.txt` et `/sitemap.xml` sont servis par le même handler. **Les aperçus restent noindex/nofollow**, avec exclusion dans robots.txt. Lors d’une future publication approuvée en production, seule `/decouvrir` est autorisée à l’indexation ; la racine reste la démo. Le canonique et le sitemap utilisent l’origine servie. Si un domaine de marque est retenu, `NAITEA_PUBLIC_ORIGIN` peut définir son origine HTTPS en production. Aucun domaine ou variable n’a été modifié pour cette passe. Le classement dans les moteurs n’est pas garanti.

Les images utilisent l’optimisation native Vercel, limitée aux trois dossiers d’assets autorisés, sans hôte distant. Les originaux restent préservés. Le serveur local sert les originaux sur cette URL pour vérifier les parcours ; les performances de compression doivent être contrôlées sur l’aperçu Vercel.

## Vérification

```bash
PORT=4185 NODE_USE_ENV_PROXY=1 node tests/serve-demo.cjs
node --test tests/*.test.cjs
BASE_URL=http://127.0.0.1:4185 node tests/browser-landing.cjs
```

Le navigateur vérifie le rendu, les images, les onglets et dialogues au clavier, les liens, le menu fixe, l’inscription directe et les largeurs 1440/768/390/320 px. La soumission d’inscription est testée avec un faux SDK isolé, jamais contre Supabase. `tests/capture-landing.cjs` permet d’actualiser les quatre captures à partir de données fictives dans un navigateur neuf.

Vérification du 20 novembre : 63 tests unitaires réussis, parcours landing validé en local et sur Vercel, formulaire hébergé chargé, parcours plateforme existants validés sans écriture externe. Logo WebP optimisé de 13 466 octets avec alpha de 0 à 255 ; photo du premier écran de 101 998 octets. Les captures ordinateur/mobile sont conservées dans `/workspace/artifacts/naitea-landing-live/`.

La configuration réelle des redirections et emails d’authentification reste celle du projet Supabase. La procédure déjà documentée pour les URLs de confirmation d’une prévisualisation doit être revue avant une campagne publique. Aucun compte réel, donnée Supabase, réglage Stripe ou service d’envoi n’a été modifié. Aucune fusion main ou mise en production autorisée.
