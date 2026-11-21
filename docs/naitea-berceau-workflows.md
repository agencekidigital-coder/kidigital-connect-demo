# Identité Berceau et nouveaux parcours

20 novembre 2026. Branche `feature/naitea-supabase-auth-foundation`. Le cadre de démonstration reste celui confirmé par l’utilisatrice : données locales, pas de paiement ni d’envoi réel. L’utilisatrice a précisé qu’elle souhaite des rappels **email et SMS en démonstration**.

## Identité

Les fichiers officiels Drive sont documentés dans [les sources Berceau](../assets/berceau/SOURCES.md). Le nouveau logo, le symbole, les quatre couleurs et Naitea Titres sont utilisés dans l’interface, avec Source Sans 3 pour les champs, textes et données. Les polices sont servies localement. Les 24 pictogrammes WebP peuvent être insérés dans le studio puis déplacés, redimensionnés ou supprimés.

La barre latérale professionnelle, l’en-tête et le menu mobile sont fixes. Les rubriques d’une fiche restent accessibles sous l’en-tête. Les boutons principaux sont pourpres, les textes sur les accents moutarde restent pourpres et les états restent identifiables par leur libellé.

Les créations déjà enregistrées ne sont pas recolorées. Les nouvelles démonstrations utilisent les couleurs Berceau ; une professionnelle peut appliquer la palette et les polices depuis Ma charte graphique, en conservant son logo et son identité personnelle. Les styles propres des éléments du studio restent éditables.

## Bons cadeaux

Réglage dans **Bons cadeaux**, achat depuis la fiche parents.

1. La professionnelle choisit les montants proposés, la possibilité d’un montant libre, sa plage, la validité et les types de prestation couverts.
2. La famille choisit un montant ou un accompagnement précis, puis indique un bénéficiaire fictif, un message facultatif et ses coordonnées de test.
3. La confirmation crée un code préfixé `DEMO-`, un bon PNG téléchargeable et un modèle d’email non envoyé. Une notification locale est ajoutée.
4. Le code s’applique dans le formulaire d’atelier ou de rendez-vous individuel. Le tarif, la part du bon, le complément simulé et le solde restant sont visibles.
5. Une utilisation partielle conserve le solde. Un bon épuisé, expiré, annulé ou réservé à une autre prestation est refusé. Une même transaction ne peut pas être appliquée deux fois.
6. L’annulation d’une réservation recrédite son montant sur le bon une seule fois, sans modifier la date d’expiration. Il ne s’agit pas d’un remboursement bancaire.

Les montants sont calculés en centimes. La date d’expiration respecte le dernier jour du mois cible. Un achat sans place disponible ne consomme pas le bon sur une liste d’attente.

Le lien d’achat ouvre la démonstration parents, sans transporter de coordonnées ni de codes. Les bons et soldes restent dans le navigateur qui les crée. Ils n’ont aucune valeur monétaire réelle et ne sont pas utilisables entre appareils. Un usage réel nécessitera notamment des paiements vérifiés, un code lié à la professionnelle, une persistance et des débits atomiques côté serveur, ainsi que des conditions commerciales adaptées.

## Fiche professionnelle

- Actions pour découvrir les accompagnements, appeler et écrire ; le téléphone s’affiche lorsqu’il a été renseigné.
- Instagram, Facebook et WhatsApp conservés ; LinkedIn et TikTok sont aussi modifiables dans Réseaux sociaux.
- Spécialités, publics et langues sélectionnables par mots clés recherchables. Ajout d’un mot clé libre possible.
- Formations et spécialisations dans des lignes avec intitulé, organisme et année. Elles restent déclaratives, sans badge de vérification fictif.
- Photos de séance importables dans la galerie existante après confirmation des droits, avec descriptions et mention d’illustration si nécessaire.
- Horaires groupés par jours et lieux conservés. Ils restent distincts des créneaux réservables.
- Contact fictif avec notification locale conservé ; aucun abonnement marketing implicite.

Le téléphone d’une inscription à un atelier est facultatif. Le même champ est réutilisé pour les rappels SMS afin d’éviter une double saisie. Les numéros fournis sont distincts de la demande de recevoir des SMS.

## Rappels email et SMS

Réglages dans **Mes automatisations > Rappels email et SMS**. Les délais sont configurables séparément pour les ateliers et les rendez-vous individuels. Les règles utilisent l’heure de Paris et les changements d’heure.

- Une réservation confirmée et future peut préparer des rappels email.
- Un rappel SMS exige un numéro de test valide et une demande distincte de la famille pour cette réservation.
- Une autorisation de newsletter n’active pas les SMS.
- Les demandes en liste d’attente, les annulations, les dates passées et les délais déjà dépassés ne créent pas de nouveaux rappels.
- Les préparations sont identifiées par réservation, date, délai et canal pour éviter les doublons lors des rafraîchissements.
- Une annulation ou la désactivation des rappels retire les préparations futures. Une échéance passée reste indiquée comme non envoyée.

Les emails apparaissent dans la boîte de démonstration et les deux canaux sont consultables dans le panneau de rappels. Aucun fournisseur SMS, SMTP ni ordonnanceur réel n’est activé. Une production nécessitera un service d’envoi, une file de tâches durable, une gestion des erreurs et un suivi des délivrances.

## Google Agenda

Un bouton dans la confirmation ouvre la création manuelle d’un événement Google Agenda. La professionnelle peut également choisir un événement depuis Rendez-vous ou télécharger un export `.ics` de ses ateliers et rendez-vous futurs.

Les événements contiennent titre, horaires, lieu disponible et lien public. Les noms et coordonnées des familles ne sont pas exportés comme participants. Les horaires sont exportés en UTC, avec le contexte Europe/Paris, et le texte ICS est échappé.

**La synchronisation automatique Google n’est pas connectée.** Un clic ouvre Google ; la personne valide l’ajout dans son compte. L’import d’un fichier n’est pas une synchronisation. Les événements Google ne ferment pas encore les disponibilités Naïtea.

Une connexion réelle demandera un client OAuth Google approuvé, le consentement de la professionnelle, le stockage sécurisé des jetons et du calendrier choisi, la lecture des occupations et la gestion des changements/annulations. Aucun accès Google Calendar ni événement distant n’a été créé pendant cette passe.

## Réponses aux avis

L’assistant se trouve dans **Personnaliser mon profil > Ma fiche Google et les avis > Répondre aux avis**. La professionnelle colle un avis, choisit le ton et la longueur, modifie la réponse, sauvegarde un brouillon puis la copie pour validation sur Google.

Par défaut, le résultat est clairement indiqué comme un **modèle local de démonstration**, sans IA distante connectée. Les exemples d’avis sont fictifs et ne modifient pas la note Google affichée. Les avis individuels ne sont pas importés automatiquement.

`api/review-reply.js` prépare une génération IA authentifiée et limitée. Elle est désactivée tant que tous les réglages requis ne sont pas présents :

- `BERCEAU_REVIEW_AI_ENABLED=true` après autorisation de l’administratrice.
- `AI_GATEWAY_MODEL`, identifiant exact du catalogue AI Gateway ; `openai/gpt-4.1-mini` a été vérifié dans le catalogue public le 20 novembre 2026, sans requête de génération réelle.
- Authentification serveur AI Gateway, avec `AI_GATEWAY_API_KEY` ou le jeton OIDC Vercel. Ne jamais communiquer de secret dans une conversation ni dans le navigateur.
- Les variables publiques Supabase existantes pour vérifier la session, sans écriture en base.
- `AI_REVIEW_ALLOWED_USER_IDS`, liste explicite des comptes autorisés pour cette prévisualisation.

Une requête configurée exige une session valide, un compte autorisé et l’accord d’envoyer le texte. Elle borne la taille du texte et de la réponse, et limite les demandes par compte et par instance. Avant un lancement général, remplacer cette limite locale par un quota partagé et définir les droits professionnels et budgets de production.

Le texte d’avis est traité comme une entrée non fiable. Le modèle reçoit la consigne de ne pas suivre ses instructions, de ne pas confirmer une relation de soin et de ne pas révéler de noms, coordonnées ou détails médicaux. Cela ne remplace pas la vérification humaine ni le retrait préalable des informations sensibles.

Aucun secret, service facturé, compte autorisé ou variable d’activation n’a été ajouté pendant cette passe. La génération distante est vérifiée avec des réponses simulées dans les tests. Aucune réponse n’est publiée automatiquement ; une publication par API Business Profile nécessitera une autorisation Google distincte.

## Vérifications

- 34 tests unitaires : montants, validité, usages partiels et remboursements locaux, fuseau horaire, ICS, consentement SMS, rappels et protections de l’API IA, plus les tests existants.
- Parcours navigateur Berceau : identité, menu fixe, achat et téléchargement du bon, réservation individuelle avec complément, annulation et recrédit, utilisation en atelier, rappels SMS avec accord, export agenda sans coordonnées, mots clés, réseaux, réponse locale à un avis, pictogramme dans le studio et mobile.
- Parcours existants du profil et de l’éditeur V11 : coordonnées, galerie, FAQ, horaires, textes enrichis, recadrage, copier-coller, couleurs, partages de fichiers et filtres familles.
- Aucune erreur JavaScript constatée dans ces parcours ; aucune écriture externe Supabase, Stripe, Google ou IA.

La livraison est une prévisualisation Vercel. Aucun déploiement de production ni fusion dans main.
