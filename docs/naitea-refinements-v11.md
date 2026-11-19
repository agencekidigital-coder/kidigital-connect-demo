# Ajustements du 19 novembre 2026

Branche `feature/naitea-supabase-auth-foundation`. Cette passe conserve le fonctionnement en démonstration et ne modifie ni Supabase, ni Stripe, ni la production.

## Éditeur

Le texte d’un objet peut contenir plusieurs styles. Sélectionner la ligne ou les mots puis utiliser G/I/S, la taille, la couleur ou le catalogue de polices. L’interligne s’applique au bloc et l’espacement des lettres peut s’appliquer à une sélection. Les styles sont enregistrés dans des segments JSON ; aucun HTML utilisateur n’est stocké. Les exports chargent les polices de chaque segment et dessinent les styles, y compris le soulignement.

Le menu d’événement actualise titre, date, heure, lieu et autres informations liées, sans obliger à réappliquer le modèle. Le texte préparé pour la publication suit cet événement ; les textes personnalisés sont gardés par événement. Le retour en arrière maintient leur association.

Les traits intégrés aux anciennes compositions deviennent des formes ordinaires. Sélection directe ou panneau « Éléments du visuel », puis corbeille/Suppr. Les objets se copient/collent avec Ctrl/Cmd C et V ; la saisie dans les champs conserve son comportement habituel.

Chaque sélecteur de couleur du studio propose les couleurs de la charte avant une couleur personnalisée.

Les photos ont un cadre distinct du cadrage :

- Redimensionner le cadre adapte l’image en conservant son rapport largeur/hauteur.
- « Déplacer la photo dans le cadre » ou un double-clic sur la photo active le déplacement interne.
- Zoom et recentrage restent disponibles.
- « Laisser dépasser la photo du cadre » autorise le débordement, également dans le PNG exporté.

Les images et les textes d’un export Canva déjà aplati restent un seul objet image. Les futurs modèles Canva envoyés par l’utilisatrice seront reconstruits en éléments modifiables si nécessaire.

## Instagram

Le JPEG est préparé avant le clic de partage pour conserver le geste utilisateur exigé par les navigateurs mobiles. Les formats de publication restent compatibles avec le fil Instagram ; une composition trop haute/large est contenue sur le fond du document plutôt que recadrée. Les stories gardent leur format vertical.

Sur un appareil acceptant le partage de fichiers, seul le JPEG est transmis au menu natif pour Instagram. La légende peut être copiée séparément, car Instagram ne reprend pas systématiquement le texte des autres applications. Sur ordinateur ou après un refus du partage natif, l’interface propose le JPEG téléchargé, la copie de la légende et l’ouverture d’Instagram avec le parcours Créer/Publication/import.

La publication finale est faite par l’utilisatrice dans Instagram. Une publication directe via Meta nécessiterait une intégration et des autorisations distinctes ; aucune n’a été activée. Le transfert natif est testé avec une simulation de l’API de l’appareil, sans publication réelle.

## Accompagnements et fiche publique

Les cases de modalités ouvrent leurs propres champs. Domicile : zone et frais facultatifs par km/forfait/distance incluse. Visio : plateforme, avec option Autre. Cabinet : adresse. Téléphone : numéro professionnel facultatif. Les détails actifs sont enregistrés et présentés aux parents. Les frais affichés sont à confirmer avant la séance ; le prototype ne calcule pas une distance et ne débite pas de supplément.

La fiche accepte plusieurs plages d’ouverture : groupe de jours, heures ou sur rendez-vous, modalité et adresse/zone/outil. Exemple possible : lundi-vendredi à domicile, samedi en cabinet. Ces horaires publics ne créent pas automatiquement de créneaux réservables ; ceux-ci restent dans Rendez-vous. Le numéro public comporte une icône téléphone.

## Familles

Les filtres ajoutent une catégorie d’atelier et une date ou « Tous ». Une date correspond à l’atelier auquel la famille est liée ; une autre inscription le même jour ne suffit pas. Les événements individuels affichent aussi leur date pour distinguer deux sessions du même atelier.

## Google Places : qui fait quoi ?

| Responsable | Action |
| --- | --- |
| Responsable du projet Google Cloud de Naïtéa | Activer Places API (New), autoriser sa facturation, définir quotas et restrictions de clé |
| Administratrice technique ou développeur Naïtéa | Configurer `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACES_PLACE_ID` côté serveur Vercel, dans la prévisualisation autorisée, puis redéployer cet aperçu |
| Professionnelle | Fournir la fiche Google exacte et vérifier le nom de l’établissement avant l’affichage |
| Familles | Aucune configuration |

La clé doit être saisie dans le gestionnaire de secrets/variables serveur Vercel, jamais dans le chat ou le profil public. Le lien fourni précédemment correspond à Kidigital ; ne pas attribuer ses avis à une autre professionnelle. L’adaptateur reste inactif sans configuration. L’aide intégrée à la fiche explique ces étapes. Voir [le détail du raccordement](naitea-refinements-v10.md).

## Rappel Canva

L’utilisatrice a demandé un rappel dans une semaine. Un rappel ponctuel est programmé le **26 novembre 2026 à 13 h 34, Europe/Paris**, pour l’envoi des modèles à intégrer ultérieurement. Aucun modèle tiers n’a été importé pendant cette passe.

## Vérification

```bash
node --test tests/editor-v11.test.cjs tests/workspace-tools.test.cjs tests/google-reviews.test.cjs tests/font-handler.test.cjs
BASE_URL=http://localhost:4181 CHROMIUM_PATH=/usr/bin/chromium node tests/browser-v11.cjs
```

Les contrôles navigateur couvrent la sélection partielle et le texte entier, les polices, les styles, les deux espacements, l’export de lignes de couleurs différentes, l’événement et sa légende, les formes, Ctrl C/V, l’annulation, le cadrage, le débordement vérifié au niveau des pixels, le JPEG Instagram et la copie de légende, les modalités, les horaires publics, l’icône téléphone et les filtres catégorie/date. Vérification à 1500 et 390 pixels, avec un contrôle de la barre de texte mobile.

Les suites des passes précédentes sont aussi utilisées pour les familles, les réservations, le consentement email, les publications, les imports transparents, la charte et les polices.
