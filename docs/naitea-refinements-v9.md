# Ajustements Naïtéa du 17 novembre 2026

## Familles et rendez-vous

La fiche famille permet de modifier nom, email, téléphone facultatif, intérêt et statut marketing. Les doublons d’email sont refusés ; l’activation d’un nouvel accord marketing exige d’en indiquer l’origine. Les réservations historiques ne sont pas réécrites lors de la modification d’une fiche.

Les disponibilités acceptent plusieurs jours et une sélection rapide lundi–vendredi. La validation est atomique : si une plage chevauche une règle existante, aucun jour n’est ajouté.

La réservation parent affiche un calendrier mensuel et sélectionne la prochaine date ayant un créneau libre, sur 90 jours et en Europe/Paris. Les jours sans disponibilité sont désactivés. Le formulaire conserve les coordonnées en cours lorsque l’horaire change.

Les dialogues ont une hauteur bornée au viewport, un en-tête fixe, un corps défilant et des champs contrastés de 16 px. Les champs et la confirmation restent sur le fond du dialogue. Les cartes ateliers disposent d’une catégorie superposée à la photo, de dates/heures/durées et de lieux agrandis. La fiche publique comporte ville agrandie, réseaux avec icônes et lien de site quand celui-ci est renseigné.

## Avis Google

Le lien fourni mène à Kidigital. La consultation automatisée de Google est bloquée : la démo affiche le lien et permet un relevé manuel daté après vérification, mais n’invente ni note ni nombre. Le nom de l’établissement et l’absence de synchronisation sont visibles. Aucun widget Google n’est chargé au simple affichage de la page.

## Emails et confidentialité

Les bienfaits sont insérés après le paragraphe « Au programme ». L’assistant reste fondé sur des modèles locaux, comme convenu.

L’email aux contacts exclut les personnes sans consentement marketing. Les destinataires peuvent être décochés. Le brouillon `.eml` utilise `Bcc` et `X-Unsent: 1`, sans destinataires visibles dans `To`. La campagne peut aussi être préparée dans la démo, sans envoi.

Les coordonnées collectées pour un rendez-vous sont limitées au nom et à l’email ; aucun renseignement de santé n’est demandé. Le lien « Mes données dans cette démonstration » permet d’effacer les données locales de réservation de test et l’activité liée. Les liens externes et partages ne s’ouvrent qu’après une action de la personne.

## Studio et publication

- Double-clic ou bouton « Écrire sur le visuel » pour éditer le texte directement.
- Poignée pour redimensionner photos et textes ; déplacement à la souris ou au toucher ; contrôle de l’ordre, duplication, corbeille, suppression au clavier et annulation.
- Import multiple de photos et ajout direct d’une photo de la photothèque au document.
- Retrait de la signature « Grandir, bien entourés » des modèles et créations enregistrées ; identité du logo de l’application conservée.
- Suppression des illustrations originales dans les outils présentés et la bibliothèque ; deux photos ajoutées (huit photos au total).
- Catalogue de 1 961 familles Google Fonts marquées open source, capturé le 17 novembre. Fichiers chargés à la demande par `/api/font`, avec famille/poids autorisés et licence consultable ; pas d’appel Google Fonts du navigateur. Lora/DM Sans restent servies localement. Import de fichier de police libre disponible dans le navigateur. Les familles spécialisées peuvent ne pas couvrir tous les alphabets.
- L’export PNG reprend les positions, dimensions, ordre et polices des objets. L’impression permet le PDF.
- Aperçu de publication combinant visuel et texte, confirmation explicite, boutons Instagram/Facebook, sauvegarde et reprise des brouillons dans Publications.
- Si le partage natif est disponible, il ouvre les applications du terminal. Sinon, le fichier est téléchargé et le texte est préparé ; un lien permet d’ouvrir le réseau et d’y finaliser manuellement la publication. Aucun post n’est présenté comme publié automatiquement.

## Vérifications

Parcours Chromium avec données fictives et contextes jetables : édition/persistance famille, cinq jours de disponibilité en un enregistrement, prochaine date sélectionnée, rendez-vous complet, ordre du texte, sélection de contacts consentants, édition sur le visuel, redimensionnement, suppression Espace puis annulation, import multiple, famille de police chargée réellement depuis Naïtéa, absence de requêtes directes Google Fonts, export PNG, aperçu et enregistrement d’un brouillon social.

Contrôles complémentaires réalisés : formulaires à 320/390/768/1440 px, effacement local, relevé Google de test, site public, filtre des emails et Cci, refus des familles hors catalogue et consultation de licence. Les valeurs d’avis utilisées dans les tests sont fictives.

Aucun changement des données Supabase, de Stripe ou du déploiement de production. Les seules fonctions supplémentaires concernent la distribution de polices publiques.

## Rejouer les contrôles

- Tests sans dépendance : `node --test tests/font-handler.test.cjs` (liste autorisée, méthode, origine des fichiers, cache et licence).
- Parcours navigateur : `BASE_URL=<url-de-previsualisation> CHROMIUM_PATH=<chemin-chromium> node tests/browser-v9.cjs`. Nécessite Playwright dans l’environnement de développement ; ne modifie que des données fictives dans un contexte navigateur jetable. Les captures sont écrites dans `work/verification/`.

Contrôles additionnels réalisés : import d’un fichier de police libre, insertion normale d’espaces pendant l’édition d’un texte, partage manuel de secours (fichier téléchargé, aucun post envoyé), reprise d’un brouillon visuel + texte et distribution WOFF2. Quatre tests de la fonction de polices passent.
