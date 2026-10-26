# Kidigital Connect — Démo V8

Démo statique autonome de Kidigital Connect. `index.html` est le point d'entrée du site.

## Publication sur GitHub et Vercel

1. Créer un dépôt GitHub privé, par exemple `kidigital-connect-demo`.
2. Dans le dépôt, cliquer sur **Add file → Upload files** et importer `index.html` à la racine, puis valider avec **Commit changes**.
3. Dans Vercel, cliquer sur **Add New → Project**, importer le dépôt GitHub et choisir le framework **Other** (ou aucune détection), avec le répertoire racine `./`. Laisser la commande de build vide.
4. Cliquer sur **Deploy**. Vercel fournit une URL de type `*.vercel.app`.

## Limites de la démo

- Pas de serveur, base de données ni comptes réels.
- Les données enregistrées dans le navigateur (localStorage) ne sont pas partagées entre appareils ou utilisateurs.
- Les services IA, emails, paiements, publications et réservations réelles ne sont pas connectés.
- Ne pas saisir de données réelles de familles ou d'enfants.
- Ne pas confondre dépôt GitHub privé et site web privé : l'URL déployée peut être accessible à des tiers. Activer la protection d'accès Vercel si nécessaire, selon le plan.
- Les polices Google Fonts nécessitent une connexion Internet.
