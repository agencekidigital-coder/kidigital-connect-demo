# Naïtéa — mémoire du projet et décisions

Dernière mise à jour : 20 novembre 2026.

## Cadre permanent

- Dépôt : `agencekidigital-coder/kidigital-connect-demo`.
- Branche de travail : `feature/naitea-supabase-auth-foundation`.
- Ne pas fusionner dans `main` ni déployer en production sans accord explicite.
- Ne pas modifier les données/configurations Supabase ou Stripe pour ces passes d’interface.
- L’utilisatrice a confirmé le 16 novembre 2026 qu’elle souhaite une **démonstration complète pour l’instant** : réservations locales, emails non envoyés, paiements simulés, services IA distants non activés.
- Toujours identifier les données et actions de démonstration ; ne pas les présenter comme réelles.
- Identité actuelle depuis le 20 novembre : **Berceau**, fichiers officiels fournis sur Drive. Pourpre `#590425`, corail `#BF5B45`, moutarde `#D89328`, ivoire `#FEF8ED`. Naitea Titres SemiBold pour les titres et Source Sans 3 pour l’interface. Logo Berceau avec deux parents et un bébé, 24 pictogrammes 3D. Cette demande remplace la palette Naïtéa initiale et les choix Lora/DM Sans de l’interface. Conserver les créations personnalisées déjà enregistrées.

## Stories et facturation du 20 novembre 2026

- Deux séries de trois stories pour recruter les testeuses : Berceau Naïtea et version personnelle neutre, en « je », signée **Laureen · Kidigital**, sans logo ni nom Naïtea. Mettre en avant les bénéfices métier, pas seulement des captures. Ne pas inventer tarif, gratuité ou places limitées.
- Supports et PNG détourés (logo + agenda, familles, atelier) : `/workspace/artifacts/naitea-stories-v2/`. Les 24 pictogrammes originaux du SaaS ne sont pas tous détourés ; les originaux restent préservés.
- Nouvel onglet **Facturation** : PDF et email préparés après nouvel achat payé dans la démonstration ; atelier/séance = facture fictive, bon cadeau = justificatif. Règlement sur place confirmé séparément ; gratuité et liste d’attente sans facture. Identifiants anti-doublons, numéros `DEMO-`, instantané vendeur/acheteur et centimes.
- Avoir intégral après confirmation, document d’origine conservé. Aucun remboursement réel. Email avec pièce jointe PDF disponible mais jamais envoyé. Ne pas mélanger la facture de la professionnelle pour sa famille avec l’abonnement SaaS.
- Identité légale, adresse complète, TVA, mentions, numérotation/stockage serveur, paiements vérifiés et fournisseur d’email restent à préparer avant usage réel. Les PDF sont marqués sans valeur fiscale. Source Sans 3 intégrée aux PDF pour conserver les accents et la lisibilité.
- Détails et tests : `docs/naitea-billing-demo.md`. Supabase et Stripe restent inchangés ; aucune fusion dans main ni production.

## Nouveaux parcours Berceau du 20 novembre 2026

- Sources, licences et détails dans `assets/berceau/SOURCES.md` et `docs/naitea-berceau-workflows.md`.
- Menu latéral professionnel, en-tête et barre mobile fixes ; pictogrammes 3D disponibles dans le studio. Icônes simples dans la navigation, conformément à la charte.
- Bons cadeaux locaux : configuration professionnelle, achat fictif par montant ou accompagnement, bénéficiaire/message, code `DEMO-`, téléchargement PNG, notification et email préparé. Solde partiel et complément de réservation, restrictions et expiration, recrédit unique après annulation. Pas de valeur monétaire ni de partage des soldes entre appareils.
- Fiche : actions appeler/écrire, réseaux LinkedIn et TikTok aussi dans Réseaux sociaux, spécialités/publics/langues par mots clés sélectionnables, formations en champs structurés. Galerie et horaires existants conservés.
- L’utilisatrice a confirmé **email et SMS, en démonstration**. Canaux et délais réglables ; SMS uniquement avec numéro valide et demande distincte de la famille. Téléphone facultatif dans l’inscription à un atelier, réutilisé pour éviter une double saisie. Annulations et délais passés pris en compte ; aucun envoi réel.
- Google Agenda : ajout manuel avec validation dans Google et export ICS des ateliers et rendez-vous, sans coordonnées de familles. **La synchronisation automatique n’est pas connectée** ; les occupations Google ne bloquent pas encore les créneaux Naïtea.
- Avis : assistant de rédaction, ton/longueur, brouillon et copie, sans publication automatique. Démo par modèles locaux ; adaptateur IA serveur préparé, inactif sans activation, authentification et comptes explicitement autorisés. Ne pas prétendre que la génération IA distante ou l’import des avis individuels est actif.
- Aucun secret ou accès Google/SMS/IA configuré, aucune modification de données Supabase/Stripe, aucun paiement ni message réel. Prévisualisation uniquement, sans fusion dans main.

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

## Ajustements du 18 novembre 2026

- Familles : filtres par ateliers/accompagnements, choix d’une prestation, tri alphabétique et export des résultats. Les liens reposent sur les inscriptions, demandes et rendez-vous, avec identifiants locaux stables lors d’une correction d’email ; un centre d’intérêt seul n’est pas une inscription.
- Remplacer le nom produit historique par Naïtéa dans l’interface, les textes générés, les brouillons existants et les noms de fichiers exportés. Conserver les clés de stockage historiques et les URL techniques pour éviter toute perte de données. Le nom réel de la fiche Google « Kidigital » reste une attribution de source.
- Profil : aperçu réactif pendant la saisie, email et téléphone professionnel publics, bouton « Enregistrer et voir côté parents ». Les changements restent provisoires jusqu’à l’enregistrement.
- Polices : remplacer le datalist du navigateur par un catalogue recherchable, avec chargement progressif de la liste et sélection indépendante de la recherche précédente. Catalogue commun au studio et à la charte, avec import de polices autorisées.
- PNG/WebP : conserver le canal alpha à l’import et dans l’export. Une ancienne image déjà aplatie en JPEG doit être réimportée depuis l’original ; ses pixels transparents ne peuvent pas être reconstruits automatiquement.
- Création : six modèles modifiables (Rencontre, Éditorial, Conseil, Présentation, Accompagnements, Agenda), formes/couleurs éditables, cadrage des photos, application de la charte professionnelle.
- Importer un visuel prêt en PNG/JPEG/WebP depuis Publications ou le studio ; conserver ses proportions et ouvrir directement l’aperçu visuel + texte, sans ajouter de logo ou de décoration.
- Historique du studio : boutons Revenir/Rétablir, Ctrl/Cmd Z et Ctrl/Cmd Maj Z. Les sélections seules ne consomment pas d’étape utile ; la saisie dans les champs garde son annulation native. Historique de session, limité à 50 états.
- « Ma charte graphique » : logo, quatre couleurs, polices, pictogrammes importés et réutilisables dans le studio. Annulation des imports/suppressions de fichiers de charte pendant la session.
- Avis Google : adaptateur officiel en lecture seule dans `api/google-reviews.js`, pour une fiche configurée côté serveur. Il demande uniquement les informations nécessaires, ne stocke pas les notes réelles dans localStorage et ne contient aucune clé dans le navigateur. Il reste **inactif sans configuration Google Places**. Ne pas annoncer une synchronisation réelle tant que cette configuration n’est pas faite et vérifiée.
- La configuration future nécessite `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACES_PLACE_ID`, avec API/budget Google autorisés par l’administratrice. Aucune clé, facturation ou intégration de production n’a été activée pendant cette passe.

## Documents associés

- `docs/naitea-dashboard-redesign.md` : diagnostic initial et premières passes.
- `docs/naitea-workspace-v8.md` : parcours professionnels/familles et limites de démonstration.
- `docs/naitea-refinements-v9.md` : détails et vérifications de la passe du 17 novembre.
- `docs/naitea-refinements-v10.md` : corrections du 18 novembre, tests et activation optionnelle des avis Google.
- `docs/naitea-refinements-v11.md` : texte enrichi, cadrage, partage, modalités, horaires et filtre par date.

## Ajustements du 19 novembre 2026

- Personnaliser une partie ou une ligne dans un même bloc texte : gras, italique, souligné, police, taille, couleur et espacement des lettres. Interligne réglable pour le bloc. Stocker des segments structurés et conserver les styles dans le PNG exporté, sans enregistrer de HTML brut.
- Barre de mise en forme G/I/S ; supprimer le contrôle « Graisse » et sa liste. Conserver la sélection quand on utilise la barre ou le catalogue de polices.
- Le changement d’événement actualise les informations du visuel et le texte de publication associé. Conserver les textes personnalisés par événement ; l’annulation et le rétablissement doivent garder visuel et légende cohérents.
- Transformer les anciens traits décoratifs en formes sélectionnables et supprimables. Un panneau « Éléments du visuel » permet d’atteindre les petites formes.
- Les images conservent leurs proportions lors du redimensionnement du cadre ; déplacement dans le cadre, zoom, recentrage et débordement optionnel. La prévisualisation et l’export suivent les mêmes coordonnées.
- Ctrl/Cmd C et V pour les objets du studio, en conservant les styles ; copie normale dans les champs. Palette de la professionnelle proposée pour les couleurs des textes, formes et fonds.
- Partage Instagram : JPEG compatible préparé avant le clic ; transfert du fichier seul via le menu natif pour les appareils compatibles, copie de la légende séparée. Sur ordinateur, téléchargement du JPEG, copie du texte et ouverture d’Instagram avec étapes explicites. Ne pas annoncer une publication automatique ni prétendre qu’un simple lien web importe le fichier dans Instagram.
- Ajouter le pictogramme téléphone sur la fiche parents.
- Accompagnements : détails par modalité. Domicile = zone + frais facultatifs (€/km, forfait, distance incluse) ; visio = outil ; cabinet = adresse ; téléphone = numéro facultatif. Afficher ces informations côté parents. Aucun calcul de trajet ni débit automatique des frais.
- Horaires et lieux publics par groupes de jours, heures fixes ou sur rendez-vous, modalité et lieu. Ces horaires de présentation restent distincts des disponibilités réservables.
- Familles : type d’atelier puis date ou « Tous », filtrés sur les inscriptions liées au même atelier. L’export suit la sélection.
- Google Places : activation côté administration technique Naïtéa. La responsable du compte Google Cloud autorise l’API et la facturation ; l’administratrice/développeuse configure les variables serveur Vercel. Les professionnelles fournissent uniquement leur fiche ; ne jamais demander de coller une clé dans la conversation. Aucune activation ni clé ajoutée pendant cette passe.
- Les modèles Canva de l’utilisatrice seront intégrés ultérieurement, après réception. **Rappel créé à sa demande pour le 26 novembre 2026 à 13 h 34, Europe/Paris**, après son choix explicite « Dans une semaine ».

## Audit concurrentiel et fiches du 20 novembre 2026

- Materneo étudié sur ses pages publiques : annuaire, deux fiches, agenda, offres, charte et Village. Voir `docs/naitea-materneo-benchmark.md` pour les sources, limites et axes différenciants.
- Materneo annonce déjà un agenda intégré en option, Stripe, rappels email, synchronisation Google et communauté. Ne pas présenter ces fonctions comme exclusives à Naïtéa. Aucun compte payant ni envoi réel testé chez la concurrente.
- Positionnement recommandé : relier les offres, les familles et la communication dans l’espace de travail des professionnelles. Le studio, la charte réutilisable, les filtres familles et les scénarios métier sont les principales différences à rendre exploitables ; l’annuaire public et le référencement sont des forces actuelles de Materneo.
- Fiche professionnelle enrichie : navigation, spécialités/publics/langues, approche, formations déclarées sans faux badge, informations pratiques, jusqu’à 12 photos avec droits et descriptions, FAQ, liens complémentaires, favoris locaux et recherche des accompagnements par texte/modalité.
- Prochaine disponibilité calculée à partir des règles existantes. Calendrier mensuel et réservations précédentes conservés. Les horaires publics restent distincts des créneaux réservables.
- Contact de démonstration : message fictif enregistré dans le navigateur et affiché dans le profil professionnel, notification locale, aucun email ni abonnement marketing automatique. Aucun champ de santé.
- Le lien `/?vue=parents` ouvre le profil fictif. Les modifications locales ne sont pas partagées entre appareils ; le dialogue de partage l’indique explicitement.
- Les coordonnées, réseaux, Google et horaires gardent leurs formulaires. Le nouveau contenu se règle dans Profil public > Le contenu de ma fiche, avec aperçu et enregistrement explicite.
- Le travail de naming/logo Malamae reste une exploration graphique. La plateforme conserve Naïtéa dans cette passe.
- Aucun changement des données Supabase, aucune configuration Stripe, aucun déploiement de production ni fusion dans main.

## Nouvelle passe plateforme et factures du 20 novembre 2026

- La charte actuelle est Berceau, fournie par l’utilisatrice : pourpre/corail/moutarde/ivoire et typographies du kit officiel. Elle remplace l’ancienne palette de travail rose/sauge. Logo et 24 pictogrammes détourés ; usage renforcé dans les interfaces pro/familles.
- Les pictogrammes Naïtea ne sont plus proposés aux professionnelles dans leur studio ou leur charte. Elles importent leurs propres éléments. Conserver leurs anciens visuels et personnalisations.
- Bons cadeaux personnalisables, modèles Épuré/Arche/Photo, lien et iframe d’une boutique ou d’une prestation. Le bon doit identifier clairement l’accompagnement et la professionnelle. Liens publics sans familles/codes émis/tokens, espace d’aperçu isolé.
- Exiger prénom + nom et téléphone pour les réservations/inscriptions. La famille choisit une modalité disponible ; à domicile, elle fournit son adresse personnelle privée. Cette demande remplace l’ancien téléphone facultatif.
- Ateliers : 71 catégories documentées plus choix libre, dont danse/chant prénatals et cercles futures/jeunes mamans/jeunes parents ; publics, tranche d’âge, modalité, adresse ou outil visio, description assistée selon le titre avec les bienfaits après le programme.
- Contacts orientés vers l’email de la professionnelle, tout en conservant une copie locale dans cette démo. Chatbot pratique désactivable, pas de santé ni de stockage des échanges. Horaires/lieux au début du contenu de profil.
- Google Business Profile, distinct de Google Places, pour les avis sans réponse et la publication après validation ; OAuth/PKCE, tokens serveur chiffrés, actualisation pendant l’ouverture de l’espace. Pas d’activation réelle : client OAuth/autorisation Google absents du projet. Supprimer les instructions d’installation technique du produit ; garder la documentation technique dans le dépôt.
- Agenda : liste privée des inscrits, invitations distinctes et confirmées, protection contre le partage de la liste de coordonnées. Aucun envoi Google réel pendant les tests.
- Demande ajoutée après réinitialisation : le justificatif de bon cadeau doit avoir une présentation de facture et les mentions françaises adaptées. Nouveau modèle A4 avec identité légale, coordonnées, numérotation, dates, prestation, HT/TVA/totaux, paiement et mentions. Configurer le régime par pro ; ne jamais inventer SIREN/SIRET ou régime de TVA.
- Bon à usage unique : facture selon régime, sans deuxième TVA à l’utilisation ; complément seul facturé. Bon à usages multiples : reçu sans TVA à l’émission, traitement lors de la prestation. Franchise : mention CIBS actuelle. Ne pas présenter les documents locaux/simulés comme des factures fiscalement valables ni un service de facturation électronique activé.
- Le rappel du 26 novembre à 13 h 34 Europe/Paris inclut maintenant les modèles Canva de publications, flyers et cartes cadeaux.
- Voir `docs/naitea-platform-v12.md`, `docs/naitea-workshop-research.md` et `docs/naitea-invoices.md`. Aucune fusion main ni mise en production, aucune modification Supabase/Stripe.
