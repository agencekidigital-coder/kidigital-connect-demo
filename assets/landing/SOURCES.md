# Médias de la landing Naïtea

Photos d’illustration téléchargées le 20 novembre 2026, hébergées localement. Les personnes représentées ne sont ni des clientes ni des testeuses identifiées de Naïtea. Ne pas leur attribuer de témoignage ou de recommandation.

| Fichier | Source | Licence |
| --- | --- | --- |
| mere-et-nouveau-ne.jpg | [A mother taking care of her baby, Pexels 7282769](https://www.pexels.com/photo/a-mother-taking-care-of-her-baby-7282769/) | [Pexels](https://www.pexels.com/license/) |
| maman-et-bebe.jpg | [Nataliya Vaitkevich, Pexels 4642248](https://www.pexels.com/photo/photograph-of-a-mother-carrying-her-baby-4642248/) | [Pexels](https://www.pexels.com/license/) |
| pere-et-bebe.jpg | [Anna Shvets, Pexels 11369236](https://www.pexels.com/photo/a-man-holding-his-baby-11369236/) | [Pexels](https://www.pexels.com/license/) |

La photo de petite enfance `assets/photos/family-2.jpg` est documentée dans `assets/photos/SOURCES.md` (Unsplash).

Les captures de l’espace pro, de la fiche familles, du studio et de la fiche mobile proviennent de l’interface réelle avec des données fictives, dans un navigateur isolé. Les photos visibles dans ces captures restent des illustrations de démonstration ; aucune personne n’est présentée comme cliente ou professionnelle réelle de Naïtea.

`naitea-social.png` est une composition HTML de partage avec le logo et les captures réelles des espaces pro et familles. Elle remplace la première version avec photo.

Les vidéos `demo-pro.mp4` et `demo-familles.mp4` sont des enregistrements des vrais parcours, réalisés le 21 novembre 2026 avec des données fictives. Textes explicatifs intégrés à l’enregistrement et pistes VTT françaises. Aucun achat, compte, email ou action Google réelle. Le navigateur est isolé de l’espace de travail de l’utilisatrice ; ses données locales ne sont jamais enregistrées dans ces médias. Captures et vidéos se régénèrent avec `tests/create-landing-media.cjs` ; voir la procédure FFmpeg dans `docs/naitea-landing.md`.

Les six captures `outil-ateliers.png`, `outil-fiche.png`, `outil-familles.png`, `outil-studio.png`, `outil-cadeaux.png` et `outil-facturation.png` sont réalisées le 21 novembre 2026 avec `tests/capture-landing-features.cjs`. Ce sont les vrais outils, avec les enregistrements fictifs de la démonstration et une facture simulée, sans valeur fiscale. Aucun compte, achat, paiement ou email réel. Les références Posipin, MoodDish et Cozzly ont été consultées pour la composition de la landing ; aucun de leurs médias n’est utilisé.

`SourceSans3-Variable.woff2` est une conversion sans modification des glyphes du fichier officiel `assets/berceau/typographie/SourceSans3-Variable.ttf`. La licence SIL Open Font License est conservée dans `assets/berceau/typographie/`. Les titres, le logo et les pictogrammes transparents proviennent du kit Berceau fourni par la cliente.

Mise à jour du 21 novembre : les captures et vidéos montrent désormais une photo de banque pour Camille, professionnelle fictive. Son portrait et les nouveaux pictogrammes cadeau/cookie ainsi que le favicon transparent sont documentés dans [brand-additions/SOURCES.md](brand-additions/SOURCES.md).

`laureen-kidigital.png` est la photo réelle de Laureen, issue de son propre fichier Drive `Photo_Laureen_DEMAN.png`, intégrée à sa demande à la section « Créé au plus près de votre métier ». Elle n’est pas utilisée comme portrait fictif ni attribuée à un témoignage.

Les deux vidéos intègrent une narration synthétique française (voix `fr-FR-DeniseNeural`, génération via `edge-tts`), sans imitation ni enregistrement de la voix de Laureen. Les textes sont ceux de la démonstration, sans données réelles. Les clips MP3, assemblages et textes sont dans `narration/`, et le script de reproduction est `tests/narrate-landing-videos.cjs`. Aucun service vocal n’est appelé par le site : les pistes AAC sont directement intégrées aux MP4. Les pistes VTT françaises sont activées par défaut et correspondent aux phrases prononcées.
