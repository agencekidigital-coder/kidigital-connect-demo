# Facturation de démonstration

Passe du 20 novembre 2026. Les achats, documents, paiements et emails restent dans le navigateur. Aucun envoi, paiement, remboursement, changement Stripe ou écriture Supabase.

## Parcours

- **Facturation** dans la navigation professionnelle : documents, PDF, aperçu de l’email, préparation d’un avoir intégral et règlements sur place à confirmer.
- Un nouvel achat d’atelier ou de séance avec paiement en ligne simulé prépare une facture PDF et son email transactionnel. Le document est aussi accessible depuis la confirmation parents.
- Le règlement prévu sur place prépare une attente ; la professionnelle doit **Simuler le règlement** pour produire le document. Une réservation annulée ne peut plus être réglée depuis cette liste.
- Une prestation gratuite ou une inscription en liste d’attente ne produit pas de facture d’achat. Le formulaire ne demande alors pas d’adresse de facturation ni de choix de règlement pour un atelier. Les anciennes réservations fictives ne sont pas importées comme des paiements.
- L’achat d’un bon cadeau produit une **facture de bon à usage unique** ou un **reçu de bon à usages multiples**, selon les paramètres fiscaux renseignés. La part d’un bon déjà traitée à l’émission n’est pas taxée une deuxième fois lors de la séance. Les cas sont détaillés dans [naitea-invoices.md](naitea-invoices.md) ; tous ces documents restent sans valeur fiscale dans cet aperçu.
- Un identifiant de commande local empêche les doublons. Les documents portent un numéro `DEMO-AAAA-0001`, selon l’année Europe/Paris, et figent l’identité affichée de la professionnelle, l’acheteur adulte, le libellé et les montants en centimes.
- Le PDF A4 utilise des sous-ensembles locaux de Source Sans 3 (SIL OFL), avec les accents français et le symbole euro. Le texte utilisateur est encodé dans les chaînes PDF, sans HTML ou JavaScript exécutable.
- L’email référence le même PDF, consultable dans **Voir l’email et sa pièce jointe** et dans les automatisations. Son statut reste **Préparé, non envoyé**. Aucun consentement marketing n’est ajouté. La préparation automatique peut être désactivée pour les achats suivants.
- Un avoir intégral exige une confirmation, conserve le document d’origine et ne peut être préparé qu’une fois. Il ne déclenche ni annulation de réservation ni remboursement réel. Le recrédit des bons après annulation reste géré par le parcours Bons cadeaux existant.

## Limites avant utilisation réelle

Ces documents sont explicitement **sans valeur fiscale**. Ils ne constituent pas un système de facturation conforme ou un dispositif de facturation électronique. L’adresse complète, l’identité légale, le SIRET, le régime de TVA, les mentions et le traitement des bons devront être validés pour chaque professionnelle.

L’activation réelle nécessitera des événements de paiement vérifiés côté serveur, une numérotation et des transactions fiables, une persistance protégée par professionnelle, des documents conservés côté serveur, un fournisseur d’email transactionnel, des envois idempotents et un suivi des erreurs. Un retour navigateur ne prouve pas un paiement. La facture doit être établie par le vendeur concerné ; Naïtea ne doit pas confondre cette facturation avec celle de son propre abonnement SaaS.

Les données locales ne sont pas partagées entre appareils. Ne pas saisir de données réelles de familles ou d’enfants.

## Minimisation des données de facturation, 22 novembre 2026

Les règlements sur place en attente ne conservent que les informations utiles au futur document : acheteur adulte, email, adresse de facturation ou opposition explicite, référence et montants de la prestation. Les numéros de téléphone, adresses de déplacement à domicile, prénom/âge de l’enfant, coordonnées du co-parent et préférences marketing ne sont pas recopiés dans cette liste de facturation. Ils restent gérés par leurs parcours propres lorsqu’ils sont demandés.

Le module utilise le callback `currentOffer` fourni par l’application pour reconnaître une séance individuelle gratuite. Les ateliers gratuits et listes d’attente sont détectés à partir de l’événement et du nombre de places. Cette minimisation ne constitue pas une certification RGPD : le vrai SaaS nécessite notamment une persistance protégée par professionnelle, des accès contrôlés et une politique de conservation.

Pour un bon à usage unique déjà facturé, le résumé d’achat, la liste et l’email indiquent le même montant de document que le PDF : le complément uniquement, ou zéro pour une attestation d’utilisation entièrement couverte. Le prix initial de la prestation n’est pas présenté comme un nouveau montant facturé.

## Vérifications

- 12 tests unitaires de facturation et de règles fiscales de démonstration : centimes, numérotation, idempotence, avoir, email, PDF, TVA des bons et montant du complément.
- Parcours navigateur ordinateur/mobile : achat de bon, facture d’une séance, atelier réglé sur place, pièce jointe PDF, avoir, conservation de l’original et rafraîchissement sans doublon. Ateliers et séances gratuits et inscription en liste d’attente : aucune facture ni collecte d’adresse de facturation. Les règlements en attente excluent les informations d’enfant, de visite à domicile et de marketing.
- Parcours Berceau existant conservé : utilisation partielle, complément, annulation/recrédit, rappels SMS, export agenda et créations personnelles.
- PDF ouvert par un lecteur standard, texte extrait et rendu vérifié ; polices intégrées.
- Aucune erreur JavaScript ni écriture externe observée.

## Communication pour recruter les testeuses

Deux séries de trois stories préparées : identité Naïtea Berceau et version personnelle **Laureen · Kidigital**, sans nom ni logo Naïtea. Elles mettent en avant organisation, réservations, page professionnelle, bons cadeaux, studio, flyers, charte, familles, rappels et préparation des factures. Les envois réels ne sont pas annoncés comme actifs.

Le logo et trois pictogrammes (agenda, familles, atelier) ont été détourés pour ces supports, avec de vrais canaux alpha PNG. Les fichiers officiels originaux de l’application sont conservés. Les autres pictogrammes n’ont pas été détourés pendant cette passe.

Fichiers de livraison dans `/workspace/artifacts/naitea-stories-v2/` ; images originales conservées dans `/workspace/generated_images/`. Aucune publication Instagram effectuée.
