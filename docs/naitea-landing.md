# Landing professionnelle Naïtea

Mise à jour le 21 novembre 2026. Branche `feature/naitea-supabase-auth-foundation` uniquement.

La page `/decouvrir` présente Naïtea aux professionnelles et professionnels de la périnatalité, de la parentalité et de la petite enfance. La conversion principale ouvre le formulaire d’inscription existant. La racine conserve la démonstration et `/?vue=parents` ouvre la fiche familles.

## Contenu et identité

- H1 : « Le logiciel tout en 1 des pros de la périnatalité et parentalité. » Les deux domaines sont en corail.
- La valeur comprend communiquer, trouver des clients, gérer, organiser et développer son activité. Le visuel du premier écran montre le vrai dashboard, le studio et la fiche mobile, avec données fictives.
- Le titre « Vos outils de gestion et de communication, réunis. » et son sous-titre tiennent chacun sur une ligne sur ordinateur. Ils reviennent naturellement à la ligne sur mobile.
- Les six fonctionnalités présentent prise de rendez-vous intégrée, fiche structurée pour le référencement, familles, communication, bons cadeaux, paiements et facturation. Aucune garantie de classement Google ou de demandes supplémentaires.
- Deux vidéos réelles, Pro et Familles, d’environ 35 secondes, remplacent les trois captures à onglets. Ancres `#demo-pro` et `#demo-familles`, liens profonds, clavier, historique, arrêt de l’autre vidéo, contrôles natifs et lecture sur mobile.
- Avant/avec Naïtea : comparaison des outils et démarches, sans coût concurrent inventé ni résultat client garanti.
- Présentation de Laureen validée par l’utilisatrice : maman d’un garçon de 2 ans, fondatrice de Kidigital, agence dédiée aux pros de la périnatalité et parentalité, avec lesquelles elle travaille au quotidien.
- La FAQ reste entièrement ouverte sous forme d’articles, sans accordéon.

Charte Berceau : pourpre `#590425`, corail `#BF5B45`, moutarde `#D89328`, ivoire `#FEF8ED`, Naitea Titres SemiBold et Source Sans 3. Logo/pictogrammes transparents. Sources et licences dans `assets/landing/SOURCES.md`. Les pictogrammes officiels restent réservés à l’interface, jamais proposés dans la photothèque des professionnelles.

## Essai et prix validés

L’utilisatrice a confirmé le 21 novembre :

| Offre | Présentation sur la landing |
| --- | --- |
| Ma fiche | Gratuit : présentation, spécialités, coordonnées, photos et liens. |
| Naïtea Complet | 14,90 € TTC/mois : fiche, ateliers, rendez-vous, familles, facturation, bons cadeaux et studio. |
| Lancement | 9,90 € TTC/mois pendant 12 mois pour les 50 premières abonnées Complet, puis 14,90 € TTC/mois. |

Les 30 jours d’essai précèdent les 12 mois du tarif de lancement. La limite porte sur les abonnements Complet activés à l’ouverture commerciale ; il n’existe aucun compteur fictif de places restantes. SMS, frais du prestataire de paiement et crédits IA supplémentaires sont distincts.

Les liens `offre=fiche` et `offre=complet&essai=30` présentent la sélection dans le formulaire d’inscription. **Aucun abonnement, débit, échéance d’essai ou droit d’accès payant n’est créé ou appliqué par cette passe.** Le texte de la page indique que l’aperçu ne déclenche aucun abonnement. Les quotas, attribution des 50 tarifs, expirations, facturation SaaS et services réels devront être implémentés côté serveur dans une prochaine passe autorisée. Aucun ajout de métadonnées ni modification des tables/configurations Supabase ou de Stripe.

## Témoignages de maquette

L’utilisatrice a précisé qu’elle n’a pas encore de témoignages et souhaite des exemples pour préparer leur présentation. Trois exemples sont **explicitement marqués fictifs** dans la prévisualisation, sans nom, photo, étoile ni nombre de pros satisfaits inventé. Ils ne sont pas présents dans les données structurées. Le serveur retire entièrement ce bloc lorsque `VERCEL_ENV=production` ; un test vérifie cette exclusion. Remplacer ces exemples par des retours authentiques autorisés avant leur publication comme preuve sociale.

## Vidéos et performance

`tests/create-landing-media.cjs` enregistre les vrais parcours de l’application dans des navigateurs isolés. Aucun compte, message, paiement ou rendez-vous réel. Les vidéos silencieuses contiennent des textes explicatifs, des fichiers VTT français et une transcription courte sur la page. Elles sont encodées H.264/yuv420p, 1440 × 900, 24 images/seconde, avec métadonnées au début du fichier pour la lecture progressive. Taille approximative : 1,1 Mo (Pro), 2 Mo (Familles).

Le lecteur n’effectue aucun téléchargement vidéo avant interaction (`preload=none`). Les images utilisent l’optimisation native Vercel, limitée aux dossiers locaux autorisés. Les originaux restent conservés. Le serveur local sert les images originales et gère les requêtes vidéo partielles (206), les types MIME MP4/VTT et HEAD. Les médias sont hébergés sur Naïtea, sans lecteur ni outil de suivi tiers.

## Rendu et référencement

`api/landing.js` rend `marketing/landing.html` côté serveur. Le HTML initial comprend titre, description, canonique, Open Graph/Twitter, Organization/WebPage/WebApplication et deux VideoObject. Aucun avis ou prix de démonstration dans le schema. L’image de partage représente maintenant le produit.

`/robots.txt` et `/sitemap.xml` utilisent le même handler. **Les aperçus restent noindex/nofollow.** Lors d’une future production approuvée, seule `/decouvrir` est autorisée à l’indexation ; la racine demeure la démo. `NAITEA_PUBLIC_ORIGIN` peut définir un futur domaine HTTPS en production. Aucun domaine ou variable n’a été modifié ici.

## Vérification et reproduction

```bash
PORT=4186 NODE_USE_ENV_PROXY=1 node tests/serve-demo.cjs
node --test tests/*.test.cjs
BASE_URL=http://127.0.0.1:4186 node tests/browser-landing.cjs
```

Le navigateur vérifie les largeurs 1440/1024/768/390/320 px, les titres sur une ligne sur ordinateur, les vidéos réellement décodées/lues/positionnées, les pistes françaises, les liens profonds et l’historique, le clavier, le menu fixe, la FAQ ouverte, la grille et les deux parcours d’inscription. La soumission du formulaire passe par un faux SDK isolé, jamais par Supabase. Le formulaire hébergé est aussi contrôlé sans création de compte.

Pour actualiser toutes les captures et vidéos, installer le binaire FFmpeg de Playwright (`playwright install ffmpeg`), ainsi que FFmpeg et FFprobe système. Dans l’environnement de travail :

```bash
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright BASE_URL=http://127.0.0.1:4186 node tests/create-landing-media.cjs
```

Le script historique `tests/capture-landing.cjs` redirige désormais vers ce générateur. Les captures et résultats sont conservés dans `/workspace/artifacts/naitea-landing-v2/` ; les vidéos brutes et leurs séquences dans `/workspace/artifacts/naitea-landing-recordings/`.

La configuration réelle des emails et redirections d’authentification reste celle du projet Supabase. Aucun changement de données Supabase, configuration Stripe, service d’envoi, fusion main ou déploiement de production.
