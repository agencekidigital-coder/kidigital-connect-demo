# Refonte du dashboard Naïtéa — 14 novembre 2026

## Diagnostic

- Le point d’entrée initial était `page='studioia'`. Les styles `.naitea-pro-dashboard` ne s’appliquaient qu’à `page==='dashboard'` : l’ouverture du site ne montrait donc pas l’accueil retouché.
- La production Vercel servait `main` au commit `36c8ba9`, alors que la précédente passe graphique se trouvait sur la branche de travail au commit `93938aa`. La prévisualisation `dpl_9PBY6Pyq1ogCXvpMV9M416CsYBYf` contenait bien ce dernier commit.
- Les couches CSS V1 à V7, les imports de polices placés après des règles CSS (ignorés par le navigateur) et le thème V7 appliqué en JavaScript rendaient le résultat difficile à maîtriser.
- La première passe conservait la composition initiale et le logo ne comportait pas les silhouettes.
- Les boutons Modifier et Lien / intégration étaient injectés à l’intérieur du groupe Inscriptions / Booster ; leur imbrication provoquait une mauvaise répartition sur mobile.

## Changements

- L’accueil professionnel devient le point d’entrée, sans retirer le Studio IA ni les autres rubriques.
- Composition entièrement revue : bandeau prune avec silhouettes vectorielles adaptées à la référence, statistiques cliquables, ateliers, actualité et panneau d’accompagnement.
- Navigation organisée en activité principale et deux groupes dépliables ; toutes les entrées existantes restent accessibles. Menu Plus mobile avec accès au compte.
- Charte centralisée dans `assets/naitea.css`, chargée après les styles historiques ; ancienne passe Naïtéa retirée. Palette officielle imposée au dashboard indépendamment du thème de démonstration enregistré.
- Lora Bold et DM Sans servies localement avec leurs licences OFL. Les polices supplémentaires du studio restent disponibles via le mécanisme existant.
- Cartes, boutons, états interactifs, focus clavier, barre mobile et vues tablette adaptés. Structure des actions d’atelier corrigée.
- Avertissement explicite de données fictives, activité fictive et envois simulés. Aucun indicateur de croissance ou revenu réel inventé.

## Périmètre préservé

L’authentification et les fichiers `connexion.html`, `api/` et `supabase/` ne sont pas modifiés. Aucun changement de données Supabase, configuration Stripe, variables d’environnement ou réglages de production. Le stockage local de démonstration et les gestionnaires métier existants sont conservés.

## Vérification

Contrôles Chromium automatisés : accueil par défaut, chargement réel des polices, toutes les rubriques de navigation, création et modification d’un atelier fictif, persistance après rechargement, détails des inscriptions, lien/iframe de partage, ouverture du studio, mode parents et menu Plus mobile. Contrôle des débordements à 320, 390, 430, 768, 1024 et 1440 px ; captures ordinateur et mobile inspectées.

Les écritures de test utilisent exclusivement un contexte navigateur jetable et son localStorage. Aucun compte Supabase réel ni paiement Stripe n’est utilisé. Le serveur statique local ne simule pas la fonction Vercel `/api/public-config`.

## Ajustements d’ergonomie — deuxième passe

- Bandeau mobile raccourci à environ 157 px : titre adapté, texte d’introduction réservé à l’ordinateur, accès direct aux ateliers conservé.
- Actions principales des cartes : Inscriptions et Modifier. Visuel/Booster, partage/intégration et Site & avis Google regroupés dans un panneau Plus natif, sans menu flottant susceptible d’être coupé.
- Suppression des deux injections historiques d’actions dans le HTML des cartes ; les actions sont désormais définies au même endroit.
- Ouverture de Plus au clavier, fermeture avec Échap et retour du focus au déclencheur ; boutons d’au moins 44 px.
- Dates et informations d’atelier à 12 px, légendes statistiques à 11 px, descriptions agrandies et contrastes renforcés. Bouton principal assombri pour améliorer la lecture du texte blanc.
- Vérification ciblée des actions (modification, partage, liens, Studio), clavier et affichage à 320, 390, 430, 768, 1024 et 1440 px. Aucune modification des intégrations Supabase/Stripe.
