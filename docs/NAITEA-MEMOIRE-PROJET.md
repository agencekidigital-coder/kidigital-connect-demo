# Naïtéa — mémoire du projet et décisions

Dernière mise à jour : 17 novembre 2026.

## Cadre permanent

- Dépôt : `agencekidigital-coder/kidigital-connect-demo`.
- Branche de travail : `feature/naitea-supabase-auth-foundation`.
- Ne pas fusionner dans `main` ni déployer en production sans accord explicite.
- Ne pas modifier les données/configurations Supabase ou Stripe pour ces passes d’interface.
- L’utilisatrice a confirmé le 16 novembre 2026 qu’elle souhaite une **démonstration complète pour l’instant** : réservations locales, emails non envoyés, paiements simulés, services IA distants non activés.
- Toujours identifier les données et actions de démonstration ; ne pas les présenter comme réelles.
- Identité : rose argile `#B97682`, prune `#5B3A48`, sauge `#A8B59E`, pêche `#F0C2AE`, crème `#FFF7F1`. Lora Bold pour les titres, DM Sans pour l’interface ; logo avec deux silhouettes, formes organiques, rendu chaleureux et premium.

## Travail déjà livré

- Dashboard réellement recomposé et visible à l’ouverture ; logo cliquable vers la vue d’ensemble.
- Notifications locales avec compteur et suivi des lectures ; calendrier mois/semaine/jour avec ateliers et rendez-vous.
- Navigation : activité, ateliers, accompagnements, rendez-vous, familles, Communication, Personnaliser mon profil, automatisations, communauté.
- Espace parents dédié ; ateliers, réservations, accompagnements, réseaux et liens publics.
- Disponibilités, exclusions, durée et pauses ; absence de chevauchement avec les ateliers et rendez-vous confirmés ; annulation libérant un créneau ; Europe/Paris.
- Liens d’atelier autonomes et iframe de démonstration transportant uniquement des champs publics, sans coordonnées de participantes. Les places et réservations ne sont pas synchronisées entre appareils.
- Communication regroupée ; flyers génériques ou d’événement et agenda visuel séparés. Sauvegarde locale, export PNG et impression/PDF.
- Photos Unsplash servies depuis le site, avec sources dans `assets/photos/SOURCES.md`.

## Demandes du 17 novembre 2026

- Permettre la modification des fiches familles.
- Cocher plusieurs jours de disponibilité à la fois.
- Agrandir catégorie, date, heure, durée et lieu des ateliers côté parent ; poser l’étiquette sur la photo.
- Fiche professionnelle : avis Google avec étoiles/note/nombre, icônes Instagram/Facebook/WhatsApp, ville plus grande, lien « Découvrir mon site ».
- Réservation individuelle avec agenda mensuel visible et prochaine date disponible sélectionnée ; formulaires lisibles, sans débordement.
- Libellés : « Voir les accompagnements individuels » et « Prendre rendez-vous ».
- Bienfaits placés après « Au programme » dans les textes générés à partir de modèles.
- Préparation d’un email aux contacts avec consentement marketing ; aucune diffusion automatique dans cette démo.
- Studio simple inspiré des interactions usuelles des éditeurs visuels : texte directement modifiable, photos et textes redimensionnables à la souris/au toucher, import de plusieurs photos, corbeille et suppression au clavier avec annulation.
- La touche Espace supprime seulement un objet sélectionné hors édition de texte. En édition, elle conserve sa fonction normale ; Suppr et Retour arrière sont aussi disponibles hors saisie.
- Retirer « Grandir, bien entourés » des créations ; conserver l’identité du logo de l’application.
- Catalogue recherchable des familles libres Google Fonts, import de fichiers de police autorisés ; éviter les appels du navigateur vers Google Fonts.
- Retirer les illustrations originales de la photothèque et des outils affichés ; garder et compléter les photos.
- Aperçu visuel + texte à confirmer avant partage Instagram/Facebook ; brouillons récupérables dans Publications.
- Confidentialité : collecte minimale, consentement marketing séparé, destinataires en Cci pour les brouillons, suppression locale des données de réservation de test, pas de traqueur/iframe Google pour afficher les avis.

## Google : état vérifiable

- Lien fourni par l’utilisatrice : https://share.google/X81gdGiWr4vr4Hmvu.
- Ce lien redirige vers la fiche **Kidigital** (`/g/11xms04th4`).
- Google bloque la lecture automatique par une vérification anti-robot. **Aucune note et aucun nombre d’avis réels n’ont pu être relevés. Ne pas en inventer.**
- La note et le nombre peuvent être saisis dans le profil après vérification, avec date du relevé et nom de l’établissement. Ne pas attribuer les avis de Kidigital au profil fictif Camille Martin.
- Une synchronisation réelle nécessite un accès/API approprié et reste hors de la démonstration autorisée.

## Préférence d’interface du 17 novembre 2026

- Retirer les surtitres (« eyebrows »), les tirets cadratins, les emojis décoratifs, les slogans, les conseils génériques et les introductions qui répètent les titres.
- Donner la priorité aux informations et aux actions : statistiques, calendrier, ateliers, formulaires et outils de création.
- Garder la palette Naïtéa, Lora et DM Sans ; privilégier des cartes simples, des boutons sobres et une hiérarchie lisible sur ordinateur et mobile.
- Garder les mentions utiles de démonstration, de consentement et de confidentialité. Ne pas transformer les contenus enregistrés, les brouillons ou les créations du studio lors du nettoyage de l’interface.
- La passe allège également Communication, la page parents, la communauté et la connexion. Elle ne modifie ni Supabase ni Stripe.
- Vérification dans Chromium : navigation des rubriques et des outils Communication, trois vues du calendrier, préparation d’email, aperçu de publication, nouvelle discussion et ouverture de réservation mensuelle. Aucun débordement constaté à 1440 et 390 pixels sur les vues contrôlées ; aucune erreur JavaScript.

## Limites à préserver dans les explications

- La préparation d’un brouillon email ou social n’est pas un envoi ou une publication réelle. L’envoi effectif doit être effectué par l’utilisatrice dans son outil, ou faire l’objet d’une future intégration autorisée.
- Un annuaire de polices ne signifie pas que tous les fichiers sont préchargés. Les familles sont chargées à la demande via Naïtéa ; la disponibilité des glyphes dépend de la police.
- Les mesures de confidentialité de la démo ne constituent pas une certification juridique de conformité RGPD. Le vrai SaaS nécessitera contrôles d’accès, stockage serveur, politiques de conservation et services de production revus séparément.

## Documents associés

- `docs/naitea-dashboard-redesign.md` : diagnostic initial et premières passes.
- `docs/naitea-workspace-v8.md` : parcours professionnels/familles et limites de démonstration.
- `docs/naitea-refinements-v9.md` : détails et vérifications de la passe du 17 novembre.
