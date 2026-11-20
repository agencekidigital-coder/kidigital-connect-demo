# Évolution de la plateforme du 20 novembre 2026

Branche `feature/naitea-supabase-auth-foundation`. Aucune fusion dans main, aucun déploiement de production, aucune écriture ni modification de configuration Supabase/Stripe.

## Parcours livrés en démonstration

- Logo et 24 pictogrammes détourés avec un vrai canal alpha. Usage sémantique dans la navigation, les titres/cartes et la page familles. Fichiers officiels originaux conservés ; pas de banque Naïtea accessible dans le studio ou la charte des professionnelles. Les imports personnels restent disponibles et les créations existantes sont conservées.
- Bons cadeaux : trois modèles, textes, couleurs, logo et photo personnels, aperçu, téléchargement PNG, prestation couverte et professionnelle clairement nommées. Le bon émis conserve son modèle et son intitulé même si l’offre est renommée ensuite.
- Intégration : boutique autonome et liens/iframes par accompagnement. Le lien contient uniquement les données publiques autorisées, sans familles, codes de bons émis, tokens ou adresses personnelles. Copie entre navigateurs testée. La boutique de démonstration utilise un stockage séparé pour préserver l’espace professionnel de l’appareil. Les visuels importés ne sont pas transportés dans l’URL ; un stockage public de fichiers sera nécessaire pour les publier réellement.
- Réservations : prénom, nom et téléphone obligatoires ; choix parmi les modalités de l’offre. Adresse personnelle requise seulement à domicile, visible dans la réservation privée de la professionnelle. Aucun champ de santé. Coordonnées conservées lors du changement de créneau. Adresse de facturation distincte, ou opposition explicite pour un particulier.
- Ateliers : 71 catégories regroupées et catégorie libre, neuf publics, âge optionnel, lieu/adresse structurée ou visio. Description proposée selon le titre, avec programme puis bienfaits. Brouillon local annoncé honnêtement ; adaptateur IA authentifié prêt mais désactivé sans configuration.
- Contact public : message local, notification et email transactionnel préparé pour l’adresse de la professionnelle, avec Reply-To de la famille. Action distincte ouvrant le logiciel email de la famille. Aucun envoi réel dans cette passe. Supprimer le message retire aussi son email préparé.
- Assistant public : questions pratiques sur les informations, ateliers et offres affichés, réponse santé renvoyée vers les professionnels/urgences, pas de stockage de la discussion. Activation/désactivation dans le profil.
- Horaires et lieux placés avant le reste du contenu de la fiche.
- Factures et reçus repris : voir [le modèle fiscal et ses limites](naitea-invoices.md).

## Google : intégration prête, autorisation extérieure absente

L’inventaire Vercel du projet ne présente que les variables publiques Supabase. Aucune connexion Vercel Connect, clé Google/OAuth, service email ou modèle IA n’est relié. Aucun accès Google n’a été inventé ni activé sur un compte de l’utilisatrice.

`api/google.js` et `server/google-connection.cjs` fournissent le flux OAuth officiel avec PKCE, état chiffré de dix minutes et cookies Secure/HttpOnly/SameSite. Les tokens sont chiffrés et liés à l’identité Supabase déjà authentifiée, jamais stockés dans localStorage. Aucune écriture de table ou migration Supabase.

Après activation et consentement réels : choix de l’établissement géré par le compte, import paginé des avis sans réponse et de la note/du nombre d’avis, brouillon, confirmation avant publication sur Google. Une actualisation toutes les cinq minutes est prévue tant que l’espace professionnel est ouvert et visible, avec notification des nouveaux avis. Aucun service 24 h/24 ni réponse automatique non relue n’est annoncé. L’ancien mode d’emploi technique Google a été retiré de la fiche.

Les actions Agenda créent/mettent à jour un événement identifié par professionnelle/atelier pour éviter les doublons. Une liste des inscrits peut être exportée dans un événement privé. Les invitations réelles sont un choix distinct nécessitant une confirmation ; elles excluent la liste des coordonnées et masquent les autres invités. Le serveur refuse d’ajouter une liste privée à un événement déjà partagé avec des invités. L’export global historique reste sans coordonnées familiales. Actualiser après une nouvelle inscription ; pas de synchronisation bidirectionnelle des disponibilités.

Configuration de raccordement réservée à l’administration technique : client OAuth Google autorisé pour Business Profile et Calendar, approbation Google Business Profile du projet, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CONNECTION_SECRET` aléatoire d’au moins 32 caractères, `GOOGLE_OAUTH_REDIRECT_URI` HTTPS exact `/api/google?action=callback` sur l’aperçu autorisé. Ne pas activer sur production sans accord. L’accès d’une professionnelle exige son consentement Google. Les notifications en arrière-plan 24 h/24 demanderaient une infrastructure Pub/Sub et un stockage serveur autorisés distincts.

Sources : [Business Profile, avis](https://developers.google.com/my-business/content/review-data), [OAuth](https://developers.google.com/my-business/content/oauth-setup), [publication d’une réponse](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply), [notifications Pub/Sub](https://developers.google.com/my-business/content/notification-setup), [Calendar Events](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

L’adaptateur `api/workshop-description.js` utilise la même frontière authentifiée que les réponses aux avis : activation explicite, compte autorisé, origine vérifiée, limites et modèle AI Gateway configurable. Aucune génération payante lancée. Le mode local reste utilisable sans clé.

## Vérification

58 tests unitaires : documents fiscaux de démonstration, calculs en centimes, absence de double TVA, original/avoir, données privées dans les liens, champs conditionnels, catégories, OAuth/tokens, pagination et confirmations Google.

Un parcours Google avec API fictive vérifie aussi la conservation des brouillons quand de nouveaux avis changent leur ordre, la pause de l’actualisation pendant la rédaction/confirmation et la publication liée à l’identifiant stable de l’avis relu. Ce test ne publie rien sur Google.

Parcours Chromium 1500 px et 390 px : personnalisation de bon, prestation sur le bon, PDF, boutique partagée vers un autre navigateur, atelier physique/visio, publics/âge, réservation domicile/visio, téléphone obligatoire, contact/email préparé, chatbot, horaires, export privé des inscrits et absence de banque officielle dans le studio. Les parcours antérieurs de réservation, rappels, facture/avoir, profil et édition créative sont conservés. Les services non configurés retournent un état explicite et ne réalisent aucune écriture externe.

Lancer : `NODE_USE_ENV_PROXY=1 node tests/serve-demo.cjs` (port 4182 par défaut), puis `BASE_URL=http://localhost:4182 node tests/browser-platform.cjs`. L’option proxy concerne seulement l’environnement de développement lorsqu’un proxy est fourni. Production Vercel : fonctions Node 24 et pages statiques, aucun build d’application requis.

Rappel Canva existant complété : publications, flyers et cartes cadeaux, le **26 novembre 2026 à 13 h 34, Europe/Paris**. Aucun rappel doublonné.
