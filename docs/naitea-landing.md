# Landing professionnelle Naïtea

Mise à jour le 21 novembre 2026. Branche `feature/naitea-supabase-auth-foundation` uniquement.

La page `/decouvrir` présente Naïtea aux professionnelles et professionnels de la périnatalité, de la parentalité et de la petite enfance. La conversion principale ouvre le formulaire d’inscription existant. La racine conserve la démonstration et `/?vue=parents` ouvre la fiche familles.

## Contenu et identité

- H1 raccourci : « Le logiciel tout en 1 périnatalité et parentalité. » Les deux domaines sont en corail, avec trois lignes complètes maximum, y compris sur mobile. La cible professionnelle est explicite dans le résumé, les textes et l’inscription.
- La valeur comprend communiquer, trouver des clients, gérer, organiser et développer son activité. Le visuel du premier écran montre le vrai dashboard et la fiche mobile, avec données fictives.
- Le résumé est une liste de trois bénéfices toujours visible dans la hero, après le paragraphe et avant les boutons. Il est rendu côté serveur et lisible sans JavaScript. Les mêmes éléments figurent dans le champ `abstract` du schema, complétés par la cible et les limites de la démonstration. Aucun texte réservé aux robots ni garantie de classement ou de citation par une IA.
- Le titre « Vos outils de gestion et de communication, réunis. » et son sous-titre tiennent chacun sur une ligne sur ordinateur. Ils reviennent naturellement à la ligne sur mobile.
- Les six fonctionnalités présentent prise de rendez-vous intégrée, fiche structurée pour le référencement, familles, communication, bons cadeaux, paiements et facturation. Chaque avantage dispose maintenant d’un grand encart avec texte, pictogramme et vraie capture, en alternance gauche/droite sur ordinateur. Sur mobile, le texte précède l’image. Les captures peuvent être agrandies dans un dialogue accessible. Aucune garantie de classement Google ou de demandes supplémentaires.
- La petite vignette du studio « Vos visuels, à votre image » est retirée du premier écran. Le suivi des familles est explicitement présenté comme un CRM, les paiements et les intégrations de réservation sont détaillés, et le studio mentionne les évènements et le partage natif depuis l’appareil. Aucun autopost Instagram via API n’est promis. Les marges, espacements entre textes, images et sections ont été augmentés.
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

`tests/create-landing-media.cjs` enregistre les vrais parcours de l’application dans des navigateurs isolés. Aucun compte, message, paiement ou rendez-vous réel. Les vidéos contiennent des textes explicatifs, des fichiers VTT français et une transcription courte sur la page. La narration est ajoutée par `tests/narrate-landing-videos.cjs` après la capture. Les clips synthétiques français (DeniseNeural) et leurs textes sont conservés localement dans `assets/landing/narration/`, sans imitation de la voix de Laureen. Aucun service vocal n’est sollicité au runtime. Elles sont encodées H.264/yuv420p, 1440 × 900, 24 images/seconde, avec métadonnées au début du fichier pour la lecture progressive. H.264 et AAC : 34 secondes / 1,27 Mo pour Pro, 35,625 secondes / 2,15 Mo pour Familles. Les anciennes petites légendes incrustées sont retirées ; les pistes VTT activées par défaut affichent les phrases prononcées en 28 px sur ordinateur et 19 px sur mobile.

Le lecteur conserve `preload=none` et commence la lecture automatiquement, sans son, lorsque la vidéo active devient visible. Le bouton « Activer le son » reprend la narration depuis le début. L’autre vidéo est arrêtée au changement d’onglet, les vidéos sont mises en pause hors écran et lorsque la page est masquée. La préférence de mouvement réduit empêche le démarrage automatique. Les images utilisent l’optimisation native Vercel, limitée aux dossiers locaux autorisés. Les originaux restent conservés. Le serveur local sert les images originales et gère les requêtes vidéo partielles (206), les types MIME MP4/VTT et HEAD. Les médias sont hébergés sur Naïtea, sans lecteur ni outil de suivi tiers.

Les six images `outil-*.png` sont produites avec `tests/capture-landing-features.cjs`. Le script configure des disponibilités et réalise un achat fictif dans un navigateur local isolé, pour montrer un vrai aperçu de bon cadeau et une facture de démonstration complète. Aucun compte réel ni donnée de la session de l’utilisatrice n’est utilisé.

La mise à jour s’inspire du rythme et de la hiérarchie de [Posipin](https://posipin.com/), [MoodDish](https://mooddish.fr/) et [Cozzly](https://cozzly.fr/), examinés dans un navigateur le 21 novembre : titres directs, grandes démonstrations du produit et espaces entre les sections. Aucun texte, code, visuel ou témoignage de ces marques n’est réutilisé. Les captures de référence sont dans `/workspace/artifacts/naitea-landing-v3/references/`.

## Rendu et référencement

`api/landing.js` rend `marketing/landing.html` côté serveur. Le HTML initial comprend titre, description, canonique, Open Graph/Twitter, Organization/WebPage/WebApplication et deux VideoObject. Aucun avis ou prix de démonstration dans le schema. L’image de partage représente maintenant le produit.

`/robots.txt` et `/sitemap.xml` utilisent le même handler. **Les aperçus restent noindex/nofollow.** Lors d’une future production approuvée, seule `/decouvrir` est autorisée à l’indexation ; la racine demeure la démo. `NAITEA_PUBLIC_ORIGIN` peut définir un futur domaine HTTPS en production. Aucun domaine ou variable n’a été modifié ici.

## Vérification et reproduction

```bash
PORT=4188 NODE_USE_ENV_PROXY=1 node tests/serve-demo.cjs
node --test tests/*.test.cjs
BASE_URL=http://127.0.0.1:4188 node tests/browser-landing.cjs
```

Le navigateur vérifie les largeurs 1920/1440/1280/1024/768/390/320 px, le H1 limité à trois lignes sans débordement, les titres sur une ligne sur ordinateur, l’alternance des six encarts et l’agrandissement de chaque capture, le résumé sans JavaScript, les vidéos réellement décodées/lues/positionnées, les pistes françaises, les liens profonds et l’historique, le clavier, le menu fixe, la FAQ ouverte, la grille et les deux parcours d’inscription. La soumission du formulaire passe par un faux SDK isolé, jamais par Supabase. Le formulaire hébergé est aussi contrôlé sans création de compte.

Pour actualiser les vidéos et les aperçus de la hero, installer le binaire FFmpeg de Playwright (`playwright install ffmpeg`), ainsi que FFmpeg et FFprobe système. Dans l’environnement de travail :

```bash
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright BASE_URL=http://127.0.0.1:4188 node tests/create-landing-media.cjs
BASE_URL=http://127.0.0.1:4188 node tests/capture-landing-features.cjs
node tests/narrate-landing-videos.cjs
```

Après chaque réenregistrement, relancer la narration : le générateur de captures écrase les MP4 avec une version silencieuse. La narration réutilise les clips existants sans requête distante ; la régénération vocale nécessite explicitement `NAITEA_GENERATE_NARRATION=1` et `edge-tts`. Les originaux silencieux sont conservés dans `/workspace/artifacts/naitea-landing-narration/` pendant la session.

Le script historique `tests/capture-landing.cjs` redirige vers le générateur de vidéos. Les nouvelles captures et résultats sont conservés dans `/workspace/artifacts/naitea-landing-v3/` ; les vidéos brutes et leurs séquences restent dans `/workspace/artifacts/naitea-landing-recordings/`.

La configuration réelle des emails et redirections d’authentification reste celle du projet Supabase. Aucun changement de données Supabase, configuration Stripe, service d’envoi, fusion main ou déploiement de production.

## Photos, transparence et confidentialité (21 novembre)

- La vraie photo de Laureen a été retrouvée dans son Drive : `Photo_Laureen_DEMAN.png`. La version `laureen-brand.png` adapte uniquement l’arrière-plan à la charte Berceau, sans changer son identité. Elle apparaît uniquement dans la section de présentation de la créatrice, conformément à sa demande. Le portrait de Camille est une photo de banque distincte, réservée à la professionnelle fictive des captures. Les scripts recapturent images et vidéos dans un navigateur isolé avec ce portrait.
- La fiche publique est capturée dans une vue complète de 1440 × 1000 avec ses marges ; son cadre de présentation n’en rogne plus les côtés. Des photos de parents et bébés rythment également les bénéfices ateliers et CRM.
- Le favicon et les nouveaux pictogrammes cadeau/cookie ont un canal alpha effectif. Ils sont servis par l’optimisation Vercel, en qualité autorisée 80. Les médias, polices et vidéos restent hébergés localement. Sources et licences dans `assets/landing/SOURCES.md` et `assets/landing/brand-additions/SOURCES.md`.
- Le bandeau de confidentialité est autonome (`consent.js`/`consent.css`). Il indique qu’aucun traceur facultatif n’est installé. Accepter, refuser ou personnaliser ne déclenche aucun suivi. Seule la préférence versionnée est mémorisée dans ce navigateur pendant 180 jours. Le bouton du pied de page rouvre les réglages. Les services de mesure et de publicité sont indiqués non utilisés ; ils ne sont jamais précochés. Le bandeau et le dialogue masquent la CTA mobile flottante pendant leur ouverture.
- Contrôles : `node --test tests/*.test.cjs`, `node tests/browser-consent.cjs`, puis `BASE_URL=http://127.0.0.1:4189 ARTIFACT_DIR=/workspace/artifacts/naitea-landing-v4 node tests/browser-landing.cjs`. Aucun compte réel créé ni changement Supabase/Stripe.
