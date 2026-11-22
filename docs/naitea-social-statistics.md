# Statistiques des publications

Ajout du 22 novembre 2026 dans Communication → Publications.

La connexion Meta n’est pas configurée. Les liens publics et le partage natif d’un fichier ne donnent aucun accès aux statistiques. Aucun compteur fictif ni zéro de remplacement n’est affiché.

Un import CSV fonctionne dès maintenant pour Facebook, Instagram et TikTok. L’export est lu localement (UTF-8 ou UTF-16 avec BOM), sans appel fournisseur ni téléversement. Colonnes françaises/anglaises pour titre, date, identifiant, lien, vues, impressions, couverture, mentions J’aime, réactions, commentaires, partages, enregistrements et clics. Vues et impressions, J’aime et réactions restent des métriques distinctes. Les valeurs absentes ou ambiguës sont indiquées non renseignées. Les sommes de couverture ne représentent pas une audience unique ; cette limite est affichée.

Réimporter un identifiant de publication actualise sa ligne sans la compter deux fois. Limite 500 Ko, 2 000 lignes par fichier et 3 000 lignes conservées par navigateur ; inviter à raccourcir la période si nécessaire. Validation des liens externes, échappement des textes, aucune formule exécutée. Filtre par réseau, tableau responsive et suppression locale sur confirmation. Aucun jeton Meta n’est demandé ou conservé.

L’import ne constitue pas une synchronisation. Pour automatiser le suivi, raccorder l’application Meta validée avec les permissions adaptées, des jetons chiffrés par compte et une stratégie de révocation. Les prérequis officiels sont dans `docs/naitea-beta-readiness.md`. Rien n’a été activé auprès de Meta.

Vérification : `node --test tests/social-statistics.test.cjs` et `BASE_URL=http://127.0.0.1:4192 node tests/browser-social-statistics.cjs`. Données de test synthétiques isolées, aucune publication ni écriture externe.
