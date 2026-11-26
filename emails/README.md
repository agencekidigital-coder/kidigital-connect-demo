# Emails d’authentification Naïtea

Modèle de confirmation du 24 novembre 2026, adapté à l’identité Berceau actuelle : pourpre `#590425`, corail `#BF5B45`, moutarde `#D89328`, ivoire `#FEF8ED`, logo et pictogramme PNG transparents existants. Le pictogramme contient les accents corail et moutarde. Les originaux graphiques restent inchangés.

## Installation dans Supabase

Dans **Authentication → Email → Templates → Confirm signup** :

- Objet : **Confirmez votre inscription à Naïtea**.
- Corps HTML : copier l’intégralité de [supabase-confirm-signup.html](supabase-confirm-signup.html), de `<!doctype html>` à `</html>`.
- Conserver exactement `{{ .ConfirmationURL }}` aux trois emplacements : bouton classique, bouton Outlook et lien de secours.

L’expéditeur SMTP déjà configuré est `contact@naitea.fr`, avec le nom **Naïtea**. Le modèle ne contient aucune clé, donnée de compte ou URL de confirmation réelle. Il ne nécessite aucun envoi ni changement de base pour être prévisualisé.

Les images utilisent l’origine actuellement disponible `https://naitea-beta.agence-kidigital.workers.dev`. Avant de retirer cet aperçu ou d’en protéger les images par une connexion, les héberger sur une origine publique contrôlée de Naïtea et remplacer uniquement les deux URL `src`. Le domaine `naitea.fr` n’est pas présumé raccordé. Les liens de confirmation ne doivent jamais être remplacés par une adresse fixe.

## Rendu et compatibilité

La mise en page utilise des tables de présentation, les styles essentiels inline, un conteneur conditionnel Outlook et un bouton VML pour Outlook classique. Les textes et liens restent disponibles lorsque les images ne sont pas chargées. Le message possède une prévisualisation d’inbox masquée, une langue française et une action principale. Aucun suivi d’ouverture, JavaScript, formulaire, police distante ou pixel marketing n’est ajouté.

Les polices système Trebuchet MS et Arial assurent un remplacement lisible dans les messageries qui ne chargent pas les polices de la plateforme. Le logo conserve son dessin officiel. Les PNG transparents existants sont référencés à distance sans modification ; leur poids total reste celui des originaux (environ 1,6 Mo). Le HTML est léger, mais le chargement des images dépend de la messagerie et du réseau.

L’aperçu public `assets/previews/confirmation-inscription.html` est généré par `node scripts/preview-auth-email.cjs`. Son bouton de confirmation est inactif et ses liens de confirmation sont remplacés par une ancre locale. Le bouton **Copier le HTML** récupère le modèle original, également proposé au téléchargement dans `confirmation-inscription-source.txt`. Le JavaScript et les outils d’aperçu sont exclus du modèle envoyé. Ne pas copier le code HTML de la page d’aperçu elle-même dans Supabase : utiliser son bouton de copie ou le fichier source ci-dessus.

La vérification navigateur desktop/mobile et sans images est une approximation du rendu email. Un test de réception Gmail/Outlook, du dossier indésirables et du parcours d’inscription reste nécessaire après installation. Aucun envoi réel n’est réalisé par la génération de cet aperçu.

## Réinitialisation du mot de passe
Dans Authentication → Email → Templates → Reset password, objet « Réinitialisez votre mot de passe Naïtea », copier le fichier `supabase-reset-password.html` en entier. Conserver les trois `{{ .ConfirmationURL }}`. Le modèle doit être installé manuellement : les outils disponibles ne modifient pas la configuration Auth. Aucun changement au modèle de création de compte.
