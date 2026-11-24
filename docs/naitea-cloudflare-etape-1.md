# Naïtea : première étape Cloudflare

Préparation du 24 novembre 2026. Domaine confirmé par la fondatrice : `naitea.fr`, acheté chez IONOS avec une offre email. L’adresse de la boîte n’a pas encore été précisée.

## Périmètre livré

Cette étape prépare un **aperçu technique à données fictives**, sur le compte Cloudflare de la fondatrice. Elle ne déploie aucun site, ne modifie aucun DNS, aucune donnée ou configuration Supabase et aucun réglage Stripe. La branche reste `feature/naitea-supabase-auth-foundation`.

- Worker `naitea-beta`, ressources publiques dans `dist/public`, dépendance Wrangler figée et fichier de verrouillage npm.
- `/` et `/decouvrir` affichent la landing ; `/pro` et `/familles` affichent la démonstration ; les pages de connexion et d’accueil sont conservées.
- Les chemins d’images Vercel sont adaptés à une liste limitée de ressources locales. Ils ne constituent pas un proxy vers une URL fournie par un visiteur.
- Les vidéos prennent en charge les demandes partielles nécessaires à la recherche dans la lecture, y compris lorsque le service de ressources omet leur taille. Les plages sont validées et le flux est découpé sans charger toute la vidéo en mémoire.
- La landing est rendue sans placeholder et sans exemple de témoignage fictif. Tout l’aperçu est exclu de l’indexation ; cette exclusion ne protège pas son accès.
- Les liens de partage actuels, les iframes et les anciens liens `/#atelier=…` sont conservés. Les identifiants partagés sont validés avant toute mutation locale.
- Une notice rappelle que les données restent dans le navigateur. Les automatisations, la communauté, Google et les SMS ont un cadenas. Le studio, les modèles locaux, le partage natif et les réservations simulées restent disponibles.
- Les API Google, IA, réservation réelle, paiement et administration sont bloquées **au serveur**, indépendamment des boutons et variables de fournisseurs.
- La connexion est désactivée par défaut, même si des variables Supabase sont ajoutées. Son activation est une étape distincte après vérification des emails et callbacks.
- L’API de configuration publique refuse les clés Supabase secrètes et les anciens JWT privilégiés. Le rôle décodé d’une clé ne remplace jamais la vérification d’une session utilisateur.

Les dossiers `.git`, `api`, `server`, `supabase`, `tests`, `docs`, les archives ZIP, les notes de provenance et les fichiers audio de travail ne font pas partie des ressources publiées. Les licences nécessaires et les vidéos finales sont conservées.

## Vérifications locales

Node 22 ou supérieur :

```sh
npm ci --ignore-scripts
npm test
npm run check:cloudflare
npm run dev:cloudflare
```

`check:cloudflare` effectue une compilation `--dry-run` : aucun upload ou déploiement. Le serveur local écoute sur `127.0.0.1:4194`. Avec Playwright et Chromium installés, exécuter `node tests/browser-cloudflare.cjs`. Le test utilise des données fictives et n’envoie aucun email ou paiement.

Les polices de marque, Lora Bold et DM Sans sont servies depuis les ressources locales. Le catalogue complémentaire conserve un proxy serveur à hôtes autorisés, avec cache Cloudflare et refus des redirections ; son accès réseau réel doit être revérifié sur l’URL Cloudflare avant d’en garantir la disponibilité. Les navigateurs n’appellent pas directement Google Fonts.

Validation effectuée localement : 107 tests unitaires réussis ; compilation Wrangler sans déploiement ; audit npm sans vulnérabilité connue signalée à cette date ; navigation sur le runtime Cloudflare workerd en 1440 et 390 px, images, vidéos avec plages, fichiers privés et routes bloquées. Parcours d’authentification vérifiés avec un fournisseur simulé en 1440, 390 et 320 px : inscription, confirmation, connexion, accueil, récupération, lien expiré et déconnexion. Aucun compte, email, paiement ou appel d’authentification réel créé par ces tests. Cette validation ne constitue pas un audit des politiques Supabase effectives.

## Première action dans le compte Cloudflare

Vérifier que la double authentification est activée sur les comptes Cloudflare et GitHub, et conserver leurs codes de récupération en lieu sûr. Ne jamais transmettre les mots de passe ou les clés dans le chat.

1. Ouvrir **Workers & Pages**, puis l’import d’un dépôt GitHub.
2. Autoriser l’application Cloudflare à accéder uniquement à `agencekidigital-coder/kidigital-connect-demo`.
3. Nommer le Worker **`naitea-beta`**. Sélectionner explicitement **`feature/naitea-supabase-auth-foundation`** comme branche de déploiement de cet aperçu, et non `main`. Si l’assistant ne permet pas de choisir la branche avant sa création, ne pas lancer le premier déploiement sur la branche par défaut ; créer d’abord le Worker sans domaine puis configurer la bonne branche.
4. Utiliser le fichier `wrangler.jsonc` du dépôt. Le projet est un Worker avec ressources statiques, pas un site WordPress. Racine : dépôt. Commande de compilation : `npm run build:cloudflare`. Commande de déploiement : `npx wrangler deploy`. Le fichier Wrangler lance également la compilation pour les déploiements CLI.
5. Conserver l’offre Workers Free. Aucun domaine personnalisé, aucune route sur `naitea.fr`, aucune clé fournisseur et aucun stockage Cloudflare supplémentaire ne sont nécessaires pour le premier aperçu.
6. Vérifier le récapitulatif et la branche avant le premier déploiement sur l’adresse dédiée `*.workers.dev`. Cela ne raccorde pas `naitea.fr` et ne remplace pas la production existante.
7. Lire le résultat du build et tester `/`, `/pro`, `/familles`, `/connexion.html`, les images et vidéos. Confirmer que `/api/deployment` indique `preview` et `realBookings: false`.

Les réglages sont donnés pour la version préparée dans ce dépôt : ils ne doivent pas être appliqués à une ancienne révision. Aucune activation de facturation ou dépense récurrente n’est prévue par ces fichiers.

Un aperçu `workers.dev` n’est pas privé par défaut. Avant d’inviter les testeuses, définir l’accès à la bêta (invitation vérifiée au serveur ou protection Cloudflare Access selon le compte) et contrôler également l’URL alternative `workers.dev`. Ne jamais utiliser `robots.txt` ou une URL difficile à deviner comme protection.

## Email et DNS : préserver IONOS

Avant de changer les serveurs de noms du domaine, inventorier et conserver les enregistrements DNS actuels : NS, A/AAAA/CNAME utiles, MX avec priorités, TXT SPF, DKIM et DMARC, ainsi que les autres vérifications de propriété. Copier les valeurs exactes fournies par IONOS ; ne pas les deviner. Il doit rester un seul enregistrement SPF par nom DNS.

Créer et vérifier la boîte IONOS : envoyer un message vers une adresse extérieure puis répondre. La boîte de contact et le service d’envoi automatique de la plateforme ont des usages distincts. La future configuration Resend se fera à partir de ses valeurs DNS réelles, éventuellement sur un sous-domaine d’envoi, sans remplacer les MX de la boîte IONOS.

Le domaine peut rester enregistré et renouvelé chez IONOS pendant que Cloudflare gère son DNS et son hébergement. Le raccordement DNS sera réalisé après validation de l’aperçu et de l’inventaire email.

## Étapes suivantes pour de vraies réservations

1. Examiner le projet Supabase existant, ses sauvegardes, les tables et les politiques effectives. Préparer une migration versionnée et sa procédure de retour arrière avant toute modification.
2. Stabiliser l’origine de la bêta. Configurer uniquement ses URL de confirmation/récupération exactes, un SMTP approprié et les protections anti-abus. Ne pas corriger un aperçu en remplaçant aveuglément la Site URL de production.
3. Enregistrer chaque fiche, offre, disponibilité, famille et réservation avec un propriétaire vérifié côté serveur. Refuser les identifiants de compte fournis comme preuve par le navigateur.
4. Activer et tester les politiques RLS ; vérifier avec deux comptes réels de test qu’un compte A ne peut ni lire ni modifier les objets du compte B, y compris par appel API direct.
5. Gérer les disponibilités et doubles réservations par transaction/contrainte serveur, pas par calcul dans le navigateur. Envoyer les confirmations uniquement après enregistrement effectif, avec traitement des doublons.
6. Tester la persistance sur deux appareils, les annulations, les erreurs email et une restauration de sauvegarde. Définir les informations de confidentialité, durées et contacts avant de recueillir les coordonnées de familles.

Les fonctions de réservation de cet aperçu restent fictives jusqu’à la réussite de ces contrôles. Les paiements et factures réels seront raccordés dans un lot distinct.

## Back-office de la fondatrice

Le back-office doit permettre la recherche des professionnelles et l’ouverture d’un espace support pour consulter/corriger leurs fiches, offres, disponibilités et réservations. Il ne doit pas utiliser leur mot de passe.

Prérequis : rôle administratrice attribué au serveur, session vérifiée pour chaque opération, MFA exigée et vérifiée au serveur, périmètre de compte explicite, accès support justifié et révocable, journal d’interventions enregistré au serveur. Une professionnelle ne peut pas s’attribuer un rôle via ses métadonnées modifiables ou `localStorage`. Les clientes doivent être informées des accès support prévus.

Les clés privilégiées, si elles sont nécessaires à ce futur serveur, ne doivent jamais être incluses dans les pages, le dépôt ou l’API publique. Les mots de passe ne sont pas consultables ; les coordonnées de carte restent chez le prestataire de paiement.

**Aucun back-office métier serveur n’est livré dans cette première étape.** Les éventuels panneaux « administratrice · démo » du prototype restent des simulations locales.
