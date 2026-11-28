# Factures et bons cadeaux : modèle du 20 novembre 2026

La présentation et les règles de calcul ont été reprises après la demande de factures structurées. Cette branche reste une démonstration : aucune vente réelle, TVA déclarée, émission fiscale, facturation électronique ou livraison d’email n’est activée.

## Informations figées par document

Identité légale et nom commercial, EI/statut juridique, forme/capital pour une société, adresse complète, SIREN contrôlé, SIRET complémentaire cohérent, immatriculation/TVA si applicables, acheteur adulte, adresse de facturation ou opposition explicite d’un particulier, bon de commande éventuel, dates d’émission/achat/prestation, référence du bon et prestation couverte, bénéficiaire, quantité, prix et TVA en centimes, total, règlement et net à payer. Les mentions particulières et l’option de TVA d’après les débits sont configurables.

Le périmètre est celui des prestations aux particuliers en France. L’indemnité de recouvrement de 40 € des relations entre professionnels n’est pas appliquée aux familles. Les règles des biens matériels, opérations internationales, autoliquidation ou régimes spéciaux ne sont pas automatisées.

Le PDF A4 utilise les polices locales Source Sans 3, des colonnes, un tableau de désignation, un bloc de totaux, les mentions et le numéro/page en pied. Tout texte externe est encodé dans les chaînes PDF ; aucun HTML, opérateur PDF ou JavaScript utilisateur n’est exécuté. Les informations conservées lors de la création ne changent pas avec la fiche publique. Les anciens documents sont affichés sans mutation de leur original.

## TVA des bons

- **Usage unique** : le lieu d’imposition et la TVA sont connus à l’émission. La professionnelle doit confirmer ce critère ; le nombre de prestations proposées ne suffit pas à classer le bon. Facture de bon cadeau avec TVA selon le régime, ou mention de franchise/exonération.
- **Usages multiples** : aucune TVA facturée à l’émission. Reçu d’achat avec une présentation structurée et la valeur du bon ; pas de faux total HT/TVA déductible. Le traitement de TVA intervient lors de la fourniture effective de la prestation.
- **Non classé/régime absent** : aucune TVA à 0 % n’est inventée. Les informations manquantes sont indiquées et le document reste un aperçu sans valeur fiscale.
- **Utilisation d’un bon déjà traité à l’émission** : la part couverte n’est pas taxée une deuxième fois. Le complément seul est facturé ; si tout est couvert, une attestation d’utilisation est produite. Un avoir sur le complément porte uniquement sur ce complément, sans rembourser une deuxième fois le bon.

La franchise en base utilise la mention actuelle « TVA non applicable, art. L. 223 et s. du code des impositions sur les biens et services (CIBS). » Une exonération spécifique demande son fondement juridique. Les prix de la démo sont considérés comme des prix TTC ; le montant HT et la TVA sont calculés en centimes avec arrondi cohérent. Le régime et le taux ne sont jamais déduits de l’intitulé du métier.

## Sources officielles consultées

- [Service Public, mentions obligatoires](https://entreprendre.service-public.gouv.fr/vosdroits/F31808), vérifié le 11 août 2026.
- [Service Public, facturation et référence CIBS](https://www.service-public.gouv.fr/entreprendre/vosdroits/F23208?profil=tout), référence CIBS depuis septembre 2026 et tolérance CGI jusqu’à fin 2027.
- [Ministère de l’Économie, mentions de facture](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir).
- [BOFiP, opérations réalisées au moyen de bons](https://bofip.impots.gouv.fr/bofip/11738-PGP.html/identifiant=BOI-TVA-CHAMP-10-10-40-50-20240214), en particulier la distinction usage unique/usages multiples et l’absence de TVA facturée à l’émission d’un bon à usages multiples.
- [BOFiP, base et exigibilité des bons](https://bofip.impots.gouv.fr/bofip/127-PGP.html/identifiant=BOI-TVA-BASE-20-40-20230118).

## Avant une émission fiscale réelle

Les numéros `DEMO-AAAA-NNNN` sont locaux. Ils ne constituent pas une séquence fiscale centralisée entre appareils. La production nécessitera identité et fiscalité validées par professionnelle, événements de paiement vérifiés côté serveur, numérotation transactionnelle, stockage/conservation et accès protégés, annulation par avoir, service d’envoi idempotent et traitement des obligations de facturation électronique/e-reporting applicables. Aucune configuration Stripe/Supabase n’a été modifiée. Les PDF actuels restent marqués « Démonstration · sans valeur fiscale ».
