# Atelier — configuration des paiements (phase 1)

Les nouveaux réglages sont enregistrés dans les brouillons. Les ateliers déjà publiés restent inchangés. Un atelier à prix zéro est gratuit ; la sélection est ajustée automatiquement. L'acompte est exprimé en euros par place (personne/duo), stocké en centimes, et strictement inférieur au prix total. Aucun paiement en ligne ni aucune commission n'est activé.

La contrainte naitea_workshop_online_payment_not_yet_active interdit la publication des modes online, choice, deposit, même en contournant le navigateur. Ne la lever que lorsque la phase suivante est déployée et testée : réservation atomique de capacité, Stripe Checkout sur le compte marchand, webhook Connect vérifié, rapprochement du montant, devise et compte, gestion des événements rejoués, expiration et annulation, remboursement, et email après confirmation. Le paiement sur place reste la valeur par défaut. 

Les accompagnements, les bons cadeaux et la facturation ne sont pas modifiés dans cette phase.
