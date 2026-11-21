# Ajustements du 18 novembre 2026

Branche : `feature/naitea-supabase-auth-foundation`. Réservations, envois et paiements restent en démonstration locale. Supabase et Stripe ne sont pas modifiés.

## Corrections et ajouts

- **Familles** : filtrage par type puis par atelier/accompagnement, tri du nom, liens conservés après correction de l’email et export de la sélection.
- **Nom du produit** : Naïtéa dans les emails générés, newsletters, partages, libellés et exports. Les copies enregistrées utilisant l’ancien nom sont mises à jour ; les URL et clés de stockage restent compatibles.
- **Profil public** : les coordonnées apparaissent dans l’aperçu pendant la saisie. L’enregistrement actualise la page parents et persiste après rechargement. Les coordonnées professionnelles affichées sont identifiées comme publiques.
- **Catalogue de polices** : recherche dédiée, 80 résultats à la fois, liste complète réaccessible après chaque choix, prise en charge du clavier et imports personnels. Les fichiers de police passent par le site.
- **Transparence** : les imports PNG/WebP restent en PNG. Le JPEG n’est utilisé que pour les images JPEG. Les anciennes conversions sans alpha nécessitent l’original.
- **Modèles** : six compositions avec textes, photos et formes indépendantes. La palette et les polices viennent de la charte. Les photos peuvent être contenues ou recadrées, avec réglage de leur position.
- **Visuels prêts** : import depuis le studio ou Publications, respect du format d’origine, aperçu immédiat et brouillon récupérable. Aucun ajout automatique sur un export Canva.
- **Annulation** : Revenir/Rétablir et raccourcis Ctrl/Cmd Z et Maj Z. Les clics de sélection ne bloquent pas le retour à une modification réelle.
- **Charte** : logo, couleurs, typographies et bibliothèque de pictogrammes ; insertion d’un pictogramme dans le studio et retour après une suppression de fichier.

## Avis Google : état et activation ultérieure

Le lien public fourni ne donne pas à lui seul accès à une API de synchronisation. Le nouvel adaptateur utilise **Places API (New)** et expose seulement la fiche configurée sur le serveur. Il ne permet ni recherche facturable arbitraire ni choix d’une autre fiche depuis le navigateur.

La connexion est prête, mais reste inactive en l’absence des deux variables serveur suivantes :

| Variable | Contenu |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` | Clé serveur autorisée pour Places API (New) |
| `GOOGLE_PLACES_PLACE_ID` | Identifiant exact de l’établissement à afficher |

L’administratrice devra activer l’API dans son projet Google, en accepter la facturation et fixer les restrictions/quotas adaptés, puis configurer ces variables dans l’environnement Vercel autorisé. Ne jamais mettre la clé dans le code, localStorage ou une variable publique. Aucune de ces actions n’a été réalisée pendant cette passe.

Le bouton **Actualiser depuis Google** permet de vérifier le nom de l’établissement. L’affichage automatique doit ensuite être activé explicitement sur la fiche. La note n’est pas attribuée à la professionnelle fictive si la source est un autre établissement. La saisie manuelle reste disponible.

Les chiffres réels renvoyés sont gardés dans l’état de l’affichage courant, sans copie persistante dans les données de démonstration. Le serveur renvoie `Cache-Control: no-store`. Les attributions Google Maps et fournisseurs sont affichées. Une erreur ne crée aucun chiffre de remplacement.

Le raccordement multi-professionnelles en production nécessitera une association authentifiée entre compte et fiche Google, hors du périmètre local actuel.

Références : [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [attributions et conservation](https://developers.google.com/maps/documentation/places/web-service/policies).

## Vérification

```bash
node --test tests/font-handler.test.cjs tests/google-reviews.test.cjs tests/workspace-tools.test.cjs
BASE_URL=http://localhost:4181 CHROMIUM_PATH=/usr/bin/chromium node tests/browser-v10.cjs
```

Les tests couvrent filtres/export, modification d’email sans perte des liens, aperçu et sauvegarde du profil, trois sélections de police successives dont Grandiflora One, pagination du catalogue, six modèles, annulation/rétablissement, conservation de l’alpha au niveau des pixels, import de logo/pictogramme/police, réutilisation de la charte, aperçu et export d’un visuel prêt. Les cas Google configurés sont vérifiés avec des réponses de test clairement distinctes de vraies notes.

Contrôle Chromium à 1440 et 390 pixels. Une passe de navigation vérifie également calendrier mois/semaine/jour, emails de démonstration, réservation mensuelle et communauté. Aucun débordement ni erreur JavaScript constaté sur les vues contrôlées.

Le serveur de développement du Cloud doit respecter son proxy réseau pour les polices. Le test distant reste nécessaire sur la prévisualisation Vercel.
