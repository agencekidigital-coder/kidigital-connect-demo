# Naïtea : passage de la démonstration à une bêta connectée

Audit du 22 novembre 2026, branche `feature/naitea-supabase-auth-foundation`. Lecture du code et des documentations officielles uniquement. Aucune activation, modification Supabase/Stripe, publication ni acquisition de domaine.

## Ce qui bloque aujourd’hui

L’authentification Supabase existe, mais les ateliers, familles, réservations et fiches restent enregistrés dans le navigateur. Un compte ne possède pas encore un espace métier synchronisé et isolé au serveur. La bêta actuelle permet des tests avec des données fictives.

L’inventaire Vercel consulté **sans déchiffrement** ne contient que `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` pour Production, Preview et Development. Aucune variable Google ou Meta. Les approbations externes n’ont pas été vérifiées.

| Fonction | État constaté | Condition pour un premier test réel |
| --- | --- | --- |
| Inscription et confirmation email | Parcours Supabase, indépendant des données métier | Vérifier Site URL, redirections exactes de l’aperçu, modèles email et livraison SMTP ; tester inscription → confirmation → connexion sur le même environnement. |
| Avis et Agenda Google | Routes serveur présentes, raccordement dormant | Autorisation Google du projet, client OAuth, secrets serveur et consentement d’une professionnelle gestionnaire. |
| Statistiques/publication sur les réseaux | Pas de raccordement OAuth ni d’API sociale repéré | Application fournisseur, permissions approuvées, jetons par professionnelle et adaptateur serveur. |
| Import du site | Exemple préanalysé `nid-de-vie.fr` dans `v6ImportPreview` | Service d’extraction sécurisé et prévisualisation avant import. Aucune analyse universelle n’existe actuellement. |
| Supervision de plusieurs clientes | Données locales, aucun backoffice serveur | Stockage par compte, autorisations serveur et accès support tracés. |

Le README conserve `kidigital-connect-demo.vercel.app` comme ancienne Site URL. Cela peut expliquer un retour à cette production si Supabase refuse l’URL demandée. **Les réglages effectifs Supabase restent à vérifier**. Prévoir aussi un SMTP dédié aux testeuses externes : le service par défaut comporte des restrictions. [URL de redirection](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Google : lire les avis et publier une réponse sont deux accès différents

`api/google-reviews.js` utilise Places pour la note et le nombre d’avis d’un établissement global. **Places ne permet pas de répondre aux avis.** Il manque `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACES_PLACE_ID`. Associer chaque professionnelle à son établissement avant l’ouverture multi-comptes.

`api/google.js` fournit OAuth/PKCE, cookies chiffrés HttpOnly et contrôle Supabase pour lire les avis, répondre après confirmation et exporter vers Agenda. Scopes : `business.manage`, `calendar.events`. Il manque `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CONNECTION_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`.

La responsable du projet Google doit obtenir l’accès Business Profile puis activer les API. Google exige notamment un établissement vérifié actif depuis au moins 60 jours et son site. Chaque professionnelle autorise son compte propriétaire/gestionnaire. En OAuth « Testing », les refresh tokens expirent après sept jours : prévoir la reconnexion en essai et la vérification des scopes avant l’ouverture générale.

Les avis en arrière-plan exigent Notifications API/Pub/Sub et un stockage serveur chiffré des jetons : les cookies actuels ne suffisent pas. La déconnexion efface les cookies sans révoquer Google ; compléter ce retrait lors du raccordement durable. Conserver la validation humaine des réponses, sans révéler de relation de soin.

Sources : [prérequis GBP](https://developers.google.com/my-business/content/prereqs), [liste des avis et note](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list), [publication d’une réponse](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply), [notifications](https://developers.google.com/my-business/content/notification-setup), [expiration OAuth](https://developers.google.com/identity/protocols/oauth2#expiration), [vérification des scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## Réseaux sociaux : connecter les comptes avant d’afficher des résultats

Commencer par Instagram et Facebook. Un lien de profil, un téléchargement ou la feuille de partage du téléphone n’accordent aucun accès aux statistiques ni à la publication via API.

| Parcours | Compte et permissions à prévoir |
| --- | --- |
| Instagram Login | Compte Instagram professionnel Business ou Creator. Pas de Page Facebook liée obligatoire. Lecture : `instagram_business_basic` + `instagram_business_manage_insights`. Publication : `instagram_business_content_publish`, demandée séparément. |
| Instagram via Facebook Login | Compte Instagram professionnel lié à une Page. Prévoir `instagram_basic`, `instagram_manage_insights`, les permissions Page nécessaires dont `pages_read_engagement` et `pages_show_list` pour choisir la Page ; ajouter `instagram_content_publish` pour publier. Les droits exacts dépendent du parcours retenu. |
| Facebook Page | Jeton Page obtenu par une personne autorisée. Statistiques : `read_insights`, `pages_read_engagement` et tâche `ANALYZE`. Publication : `pages_manage_posts` avec les tâches et permissions complémentaires du parcours. Les profils personnels ne sont pas des Pages. |

Pour des clientes externes aux rôles de test : App Review/Advanced Access pour les permissions concernées, vérification de l’entreprise selon Meta, callbacks HTTPS déclarés, confidentialité et suppression des données. Aucun raccordement Meta constaté. La passe ajoute un import local de rapports CSV dans Communication → Publications ; cet import fonctionne sans OAuth mais ne synchronise pas les réseaux.

Conserver les jetons chiffrés par compte, gérer révocation/expiration et dater les chiffres. Afficher « Non connecté » sans métrique inventée. Les métriques disponibles varient selon le compte et la version API.

TikTok peut fournir des compteurs avec Login Kit/Display API et `user.info.stats`. La publication directe nécessite le produit Content Posting et `video.publish` ; un client non audité publie en mode privé. WhatsApp `wa.me` permet dès maintenant une conversation préremplie initiée par la famille, sans donner accès aux messages ni aux statistiques. L’automatisation exige WhatsApp Business Platform, consentement de contact, gestion des webhooks et modèles approuvés hors fenêtre de service de 24 h.

Sources : [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [Insights Instagram et scopes](https://developers.facebook.com/docs/instagram-platform/insights/), [publication Instagram](https://developers.facebook.com/docs/instagram-platform/content-publishing/), [Insights Page](https://developers.facebook.com/docs/graph-api/reference/insights/), [permissions Meta](https://developers.facebook.com/docs/permissions/), [niveaux d’accès](https://developers.facebook.com/docs/graph-api/overview/access-levels/), [scopes TikTok](https://developers.tiktok.com/doc/tiktok-api-scopes/), [publication TikTok](https://developers.tiktok.com/doc/content-posting-api-get-started/), [politique WhatsApp](https://business.whatsapp.com/policy).

## Import du site : une extraction limitée, à valider

Extraire quelques pages publiques du site de la professionnelle, sans JavaScript ; fournir des brouillons avec URL source. Laisser les informations introuvables vides et faire valider avant import.

L’appel serveur doit passer par une sortie réseau contrôlée : HTTPS/443 uniquement, pas d’identifiants dans l’URL, refus des IP privées, loopback, link-local, métadonnées cloud et autres plages non publiques en IPv4/IPv6. Résoudre et vérifier les adresses **puis utiliser l’adresse validée pour la connexion** pour résister au DNS rebinding ; désactiver les redirections ou refaire ces contrôles à chaque saut. Un simple test de chaîne suivi d’un `fetch(url)` ne suffit pas. Limiter par exemple à cinq pages du même domaine, 2 Mo de HTML par page et dix secondes par requête, sans cookies/jetons ; authentifier le compte, appliquer un quota et ne pas importer de photos sans droits. Ces limites sont une proposition, pas une fonction déjà livrée. [Référence OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Backoffice fondatrice et données des familles

Prévoir un backoffice serveur avec rôles vérifiés à chaque requête : professionnelle limitée à son espace, support restreint, administratrice technique. Associer chaque objet métier à son compte et tester explicitement qu’un compte A ne peut lire ou modifier aucun objet du compte B. Un bouton admin ou un rôle dans `localStorage` ne fournit aucune autorisation. Les clés de service et jetons fournisseurs restent au serveur.

La fondatrice suit inscriptions/activation/incidents sans ouvrir par défaut les dossiers familiaux. Prévoir un accès support justifié, temporaire, autorisé selon la procédure convenue, révocable et journalisé : qui, compte, action, date, motif. Séparer ces droits des abonnements et prévoir MFA pour les accès privilégiés.

Pour une bêta réelle, enregistrer seulement l’identité et le contact du parent nécessaires à la réservation, l’offre, la date et le statut. Adresse personnelle uniquement si intervention à domicile ; tranche d’âge plutôt que date de naissance si suffisante. Aucun diagnostic, récit médical ou dossier d’enfant. Distinguer les messages de réservation de la prospection, avec opt-in marketing séparé. Définir information des familles, responsabilités Naïtea/professionnelle, contrats des sous-traitants, durées de conservation et demandes d’accès/effacement avant d’ouvrir les réservations réelles. Le bandeau cookies ne couvre pas ces obligations. [Principes CNIL](https://www.cnil.fr/fr/les-six-grands-principes-du-rgpd).

## Domaine : une seule origine pour commencer

Aujourd’hui `/decouvrir` sert la landing via une fonction Vercel ; `/` ouvre `index.html`, `/connexion.html` l’authentification et `/?vue=parents` l’aperçu familles du même espace local. `/pro` et `/familles` sont désormais des entrées distinctes vers la démonstration, et `/bienvenue.html` présente le tutoriel après connexion. Elles ne sont pas des espaces de données serveur isolés. Les liens partagés ne représentent donc pas encore des fiches publiques indépendantes enregistrées au serveur.

Architecture recommandée, après vérification de propriété et autorisation de raccordement du domaine : `naitea.fr/` pour la landing, `/pro` pour l’espace authentifié, `/familles` pour la recherche publique et `/p/{slug}` pour chaque fiche publiée. Garder `/decouvrir` comme redirection ultérieure pour préserver les liens. Une origine simplifie cookies et OAuth ; des sous-domaines ne sont pas nécessaires maintenant. Les réécritures ne remplacent jamais le contrôle des accès serveur. Prévoir les redirections de confirmation sur cette origine, la canonical et les callbacks OAuth exacts ; exclure aperçus et données privées de l’indexation. Disponibilité, propriété et DNS de `naitea.fr` non vérifiés ; aucune configuration effectuée.

Ordre conseillé : fiabiliser les emails d’authentification sur un aperçu stable, isoler les données métier par compte, puis connecter un compte Google de test et un compte social professionnel. L’import universel et le backoffice multi-clientes viennent ensuite sur ces mêmes frontières serveur.
