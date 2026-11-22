# Studio : manipulation directe et sélection multiple

Passage du 22 novembre 2026, exclusivement sur la démonstration locale.

Le défaut de taille venait du parent du texte éditable : un formatage du bloc entier modifiait sa taille enregistrée, mais le parent gardait son ancienne taille et les spans restaient à100% de celle-ci. La mise à jour synchronise maintenant la taille du parent, les formats partiels et le rendu exporté.

- Le champ numérique et les coins agrandissent et réduisent les textes. Les poignées latérales changent la largeur du cadre sans agrandir les lettres ; les poignées haut/bas règlent sa hauteur. Les images conservent le cadrage et leurs proportions dans le cadre.
- Huit poignées accessibles, dont haut/bas/gauche/droite. Leurs cibles restent à l’intérieur du canvas, y compris pour une image à fond perdu.
- Shift/clic, le bouton « Sélection multiple » (utile au tactile), la liste des éléments et Ctrl/Cmd A permettent de sélectionner plusieurs objets. Déplacement groupé, duplication, suppression, copie/collage groupés et retournements horizontaux/verticaux conservent l’historique. La saisie dans un champ conserve ses raccourcis habituels.
- Surlignage, ombre et contour peuvent être appliqués au texte sélectionné sans dupliquer le bloc. Les listes à puces s’appliquent aux paragraphes concernés. Les formats sont des données structurées ; aucun HTML arbitraire n’est enregistré. Le canvas prend en compte ces effets et les retournements dans l’export PNG.
- Huit SVG génériques Feather sont proposés séparément des pictogrammes 3D privés de Naïtea : cœur, soleil, étoile, cadeau, calendrier, discussion, sourire et maison. Licence MIT et sources conservées dans `assets/editor-icons/`. Aucun import SVG utilisateur n’a été ouvert ; les fichiers proposés sont statiques, sans script ni ressource distante.

La page publique Canva Social Media a été consultée dans Chromium et capturée comme référence générale dans `/workspace/artifacts/naitea-editor-v14/canva-public-reference.png`. Aucun compte Canva n’a été ouvert, aucun contenu privé ou code propriétaire copié. Les interactions implémentées sont celles usuelles des éditeurs graphiques.

Validation :

```bash
node --test tests/editor-v11.test.cjs
BASE_URL=http://127.0.0.1:4193 node tests/browser-editor-v14.cjs
BASE_URL=http://127.0.0.1:4193 ARTIFACT_DIR=/workspace/artifacts/naitea-editor-v14-legacy node tests/browser-v11.cjs
```

Les tests navigateur utilisent un contexte local isolé, avec des données fictives, sans création de compte, paiement, email, modification Supabase ou Stripe. Le test legacy conserve les vérifications de formatage partiel, export PNG/alpha, cadrage/overflow, copie et parcours de partage simulé.
