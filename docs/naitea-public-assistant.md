# Fiche publique, assistant et politique d’annulation

Les liens Facebook, Instagram et WhatsApp déjà enregistrés, ainsi que TikTok et LinkedIn, apparaissent directement dans la présentation publique. Les liens absents ne créent aucun bouton fictif. Les validations existantes par réseau restent utilisées.

`profile.publicPage.cancellationURL` est facultatif. Il accepte uniquement une URL HTTP ou HTTPS sans identifiants intégrés. Le texte libre existant `cancellation` est conservé. Aucun délai, remboursement ou condition juridique n’est ajouté par défaut. Le lien renseigné s’affiche dans les informations pratiques et avant confirmation des formulaires de réservation d’un atelier ou d’une séance individuelle. Il ne constitue pas une case d’acceptation juridique inventée.

L’« Assistant d’information » répond dans le navigateur à partir des offres, ateliers à venir, questions fréquentes, horaires, modalités, coordonnées publiques et tarifs de la fiche. Il garde temporairement l’offre évoquée pour les questions suivantes et comprend les salutations, remerciements et références comme « le deuxième » ou « et son prix ? ». Les informations absentes restent inconnues ; l’assistant propose les accompagnements ou le contact. Les questions médicales ne reçoivent aucun diagnostic ni traitement.

La fonction `publicChatData` construit une liste explicite de données publiques ; les familles, inscriptions nominatives, messages, codes cadeaux, adresses personnelles et jetons sont exclus. Les créneaux proviennent des fonctions existantes `nextDate` et `slots` injectées à la création du module. Aucun créneau n’est inventé si ces fonctions ne répondent pas.

La conversation reste en mémoire dans la page, limitée à dix échanges. Elle n’est pas ajoutée au stockage local ni envoyée à un serveur ou à une IA. « Effacer la discussion » remet aussi le contexte à zéro. La fermeture conserve temporairement les échanges ; recharger la page les efface.

Vérification :

```sh
node --test tests/platform.test.cjs tests/professional-profile.test.cjs tests/profile-links.test.cjs tests/chat-information.test.cjs
BASE_URL=http://127.0.0.1:4189 node tests/browser-profile-links.cjs
BASE_URL=http://127.0.0.1:4189 node tests/browser-chat-information.cjs
```

Les tests navigateur utilisent un contexte isolé et des données fictives. Ils vérifient le fil de la conversation, les créneaux publiés, l’absence d’appel API et d’enregistrement de la discussion, la navigation au clavier, les petits écrans, les réseaux visibles et le lien facultatif avant confirmation.
