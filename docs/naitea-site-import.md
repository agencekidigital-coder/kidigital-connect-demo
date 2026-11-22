# Import local des prestations d’un site

Mise à jour du 22 novembre 2026. Démonstration locale uniquement, sans écriture Supabase, paiement, email ou analyse distante.

Dans **Personnaliser mon profil → Importer mon site**, deux chemins fonctionnent immédiatement :

1. Copier le texte visible de sa page de prestations, puis le coller dans le format « Texte des prestations ».
2. Enregistrer sa page avec le navigateur, au format HTML, puis ouvrir ce fichier dans Naïtea. Les fichiers `.html`, `.htm` et `.txt` sont acceptés, jusqu’à 1 Mo.

L’adresse facultative du site sert uniquement de référence : elle ne déclenche aucune visite ou requête. L’outil ne présente plus le catalogue prérempli d’un site tiers comme le résultat d’une analyse.

Les données structurées JSON-LD `Service`/`Offer` sont utilisées lorsqu’elles existent ; sinon, l’outil cherche les titres et paragraphes de prestations. Le texte collé est découpé par titres et blocs. Les pages dont le contenu est produit exclusivement par JavaScript peuvent nécessiter de copier le texte visible plutôt que le HTML enregistré.

## Validation des offres

L’analyse seule ne crée aucune offre. Chaque prestation dispose d’une fiche éditable : titre, description, tarif en euros, durée en minutes et modalités. Les informations non indiquées dans le contenu restent vides. Un montant dans une autre devise, une fourchette, un tarif « à partir de » ou « sur devis » ne devient pas un prix fixe en euros. Un champ vide n’est jamais transformé en zéro/gratuité.

La professionnelle sélectionne les fiches, complète les champs manquants et confirme les avoir vérifiées avant l’ajout. Le nombre maximum est de 20 prestations par analyse. Une durée de 5 à 480 minutes et au moins une modalité sont nécessaires avant ajout. Une nouvelle analyse n’écrase pas une offre existante ; les doublons avec le même titre et la même référence sont ignorés.

Seules les fiches vérifiées sont ajoutées au catalogue local de démonstration. Le HTML brut, les scripts et le texte de travail ne sont pas enregistrés dans `localStorage`. Aucun profil ou lien de site existant n’est modifié automatiquement.

## Sécurité

Le HTML est traité dans un `template` détaché et inerte, puis les éléments actifs et attributs de ressources sont retirés avant `DOMParser`. Le document n’est jamais inséré dans la page. Aucun script, feuille de style, image, iframe, SVG actif, formulaire ou redirection n’est exécuté ou chargé. L’interface affiche uniquement des chaînes échappées dans ses champs. Les références de source sont limitées à HTTP/HTTPS sans identifiants ; elles ne sont jamais récupérées par le serveur.

Cette solution ne nécessite ni clé API ni accès au site de la professionnelle. Elle ne contourne pas une connexion ou une protection de site et ne doit pas recevoir de données de clientes ou de santé. Elle ne constitue pas un scanner général de tous les sites.

Une éventuelle extraction distante sera une intégration séparée : authentification, autorisation du domaine, blocage des réseaux privés et des redirections non autorisées, limites de taille/temps, respect des accès et confirmation des données. Aucun endpoint de ce type n’est activé ici.

## Modules et vérification

- `assets/site-import-tools.js` : extraction bornée, parseurs de montants/durées et validation des offres.
- `assets/site-import-ui.js` / `assets/site-import.css` : fichier/texte, aperçu, édition, confirmation et antidoublon.
- `NaiteaSiteImport.create({ getState, save, render, uid, esc, toast, navigate })` expose `screen()`, `analyse()`, `confirm()` et `syncSelection()`.
- L’application remplace les trois anciens hooks `v6ImportScreen`, `v6ImportPreview` et `v6ImportConfirm` par cette instance.

```bash
node --test tests/site-import.test.cjs
BASE_URL=http://127.0.0.1:4192 node tests/browser-site-import.cjs
```

Les trois tests unitaires et les fixtures navigateur contrôlent le JSON-LD, les titres HTML, les contenus actifs malveillants, les valeurs absentes, la révision avant création, les doublons et le mobile. Résultat : zéro requête externe, zéro écriture serveur et aucune erreur JavaScript dans ces parcours isolés. Les artefacts de cette passe se trouvent dans `/workspace/artifacts/naitea-site-import/`.
