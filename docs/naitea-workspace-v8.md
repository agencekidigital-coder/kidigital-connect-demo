# Naïtéa — parcours professionnels et familles (démonstration)

Cette passe reste explicitement en démonstration, conformément au choix confirmé le 16 novembre 2026. Aucun changement de données ou de schéma Supabase, de configuration Stripe, de service email, d’authentification ou de production.

## Fonctionnalités

1. **Logo** : bouton accessible, sur ordinateur et mobile, qui revient à la vue d’ensemble professionnelle.
2. **Notifications** : cloche avec compteur, dernières nouvelles, lecture individuelle ou globale ; persistance locale. Les inscriptions, modifications d’ateliers, rendez-vous et annulations alimentent le centre. Les onglets du même navigateur se mettent à jour via l’événement `storage`.
3. **Calendrier du dashboard** : vues mois/semaine/jour, précédent/suivant, aujourd’hui, sélection d’une date ; ateliers et rendez-vous individuels confirmés. Le détail d’un événement est ouvrable depuis le calendrier.
4. **Partage des ateliers** : liens autonomes et iframes contenant un instantané validé des seuls champs publics de l’atelier. Les nouveaux ateliers créés localement peuvent être ouverts dans un navigateur vierge. Aucun nom de participant, email ou donnée de réservation ne figure dans le lien. Les anciens liens `#atelier=` restent reconnus lorsque l’atelier existe dans le navigateur.
5. **Parents** : page dédiée sans navigation professionnelle, présentation, recherche, catégories, cartes ateliers, liste d’attente, accompagnements individuels et accès direct aux réservations. En mode démonstration, le sélecteur Pro/Parents permet de tester les deux rôles.
6. **Rendez-vous** : règles hebdomadaires par offre, horaires, durée, pause, exclusions de journées, disponibilité sur 90 jours, prise en compte des ateliers et des rendez-vous occupés, réservation et annulation. Les créneaux sont exprimés en Europe/Paris. Le parent choisit un créneau, saisit des coordonnées fictives et choisit paiement en ligne simulé ou règlement sur place prévu. Aucune carte bancaire n’est demandée.
7. **Réseaux** : liens Facebook/Instagram et numéro WhatsApp configurables dans Personnaliser mon profil → Réseaux sociaux. Le bouton WhatsApp ouvre un message prérempli avec le prénom de l’accompagnante ; aucune conversation n’est envoyée automatiquement.
8. **Communication** : modèles de textes enrichis de bienfaits adaptés à la catégorie (massage, sommeil, bain enveloppé, portage, post-partum…). L’interface précise que l’assistant IA est simulé et utilise des modèles locaux. Les légendes et textes sont éditables.
9. **Navigation et création** : Communication, Personnaliser mon profil, Mes automatisations et Communauté regroupent les anciens modules. Le studio visuel intègre textes, photos, luminosité/contraste, couleurs, police, logo, calques déplaçables, positions précises, ajout/suppression de textes ou images, annulation, sauvegarde et export PNG/impression. Les anciens outils avancés d’illustration, retouche et modèles restent accessibles dans le studio. Les flyers et agendas visuels ont des onglets et modèles distincts : flyer générique avec les offres ou flyer d’événement ; agenda d’un mois personnalisable. Les brouillons de chaque type sont conservés séparément.

## Tester un rendez-vous

1. Ouvrir **Rendez-vous** côté professionnelle et ajouter une disponibilité pour l’offre souhaitée.
2. Passer en **Parents**, choisir **Réserver un accompagnement individuel**, puis une date correspondant à la disponibilité.
3. Choisir un créneau et des coordonnées fictives ; confirmer la démonstration.
4. Revenir côté Pro : le rendez-vous apparaît au calendrier et dans Rendez-vous. Les modèles de confirmation et rappel sont visibles dans **Mes automatisations**, selon les scénarios activés. L’annulation libère le créneau.

## Photos

Six photos Unsplash sont intégrées à la photothèque, dont une maman avec son bébé, une famille et des enfants. Elles sont servies depuis le site, réutilisables dans le studio et les documents. Sources et licence dans `assets/photos/SOURCES.md`. Elles illustrent la démonstration et ne sont pas présentées comme des clientes ou des témoignages.

## Limites explicites

- Stockage dans le navigateur : pas de réservation partagée entre appareils, de verrouillage serveur, de vraie authentification des parents ni de synchronisation d’agendas externes. Un lien partagé transporte les informations publiques au moment du partage ; modifier l’atelier demande un nouveau lien.
- Les photos importées personnellement restent dans le navigateur et ne sont pas embarquées dans les liens publics ; les photos servies par le site sont partageables.
- Le centre de notifications concerne l’activité locale ; ce n’est pas un système de push/email distant.
- Les emails sont des modèles préparés, sans envoi ni tâche programmée réelle. Le paiement est simulé, sans création de session Stripe. La génération d’illustrations est locale, sans modèle IA distant.
- L’export PDF utilise la boîte d’impression du navigateur ; le document exporté reprend les calques et photos du flyer, et non un calendrier imposé.
- Avant un usage réel : stockage serveur par compte, contrôle des conflits transactionnel, publication des ateliers, stockage des images, service de notifications/emails, paiement sécurisé et webhooks doivent être connectés et testés séparément.

## Vérification

Contrôles Chromium : logo, navigation regroupée, studio et anciens outils avancés, import/retouche photo, bienfaits dans les textes, calendrier trois vues, disponibilités, réservation individuelle, exclusion du créneau occupé, confirmation et rappel préparés, notifications de nouvelle inscription, réseaux/WhatsApp, partage d’un atelier créé dans un navigateur vierge, iframe, rejet d’un lien malformé, sauvegarde de création et export PNG. Contrôles de débordement des pages principales à 320, 390, 768, 1024 et 1440 px. Tests avec données fictives et contextes navigateur jetables uniquement.

Contrôles complémentaires : indisponibilité d’une journée bloquée, réouverture de la journée, annulation libérant le créneau, formulaire ouvert dans une véritable iframe, import d’une photo dans la retouche avancée sans quitter l’espace Communication. Aucune erreur JavaScript dans ces parcours.
