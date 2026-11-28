# Narration française des démonstrations

Créée le 21 novembre 2026 à partir des parcours fictifs de Naïtea.

- Voix synthétique française `fr-FR-DeniseNeural`, générée avec `edge-tts`. Il ne s’agit pas de la voix de Laureen et aucune voix n’a été clonée.
- Le service de synthèse distante intervient uniquement lors de la génération de ces médias. Il n’est jamais appelé par la landing page.
- Les seize textes publics sont conservés dans `scripts.json`, ainsi que les repères des huit scènes de chaque vidéo.
- Les clips MP3 sont ajustés aux repères, normalisés puis assemblés dans `pro-voix-fr.mp3` et `familles-voix-fr.mp3`. La voix est également intégrée aux pistes AAC des MP4 de la landing.
- Les sous-titres accessibles sont les fichiers `../demo-pro.vtt` et `../demo-familles.vtt`. Le texte correspond à la narration. Le petit ancien bandeau incrusté a été retiré ; la landing affiche les pistes VTT agrandies.

Pour encoder à nouveau à partir des clips existants :

```bash
node tests/narrate-landing-videos.cjs
```

Le script conserve les originaux silencieux dans `/workspace/artifacts/naitea-landing-narration/`. Si les vidéos sont réenregistrées avec `tests/create-landing-media.cjs`, relancer ensuite le script de narration pour réintégrer l’audio. FFmpeg et FFprobe sont nécessaires. La régénération des clips est une opération séparée (`NAITEA_GENERATE_NARRATION=1`) nécessitant la dépendance de préparation `edge-tts`, installée dans le cache de travail, et une connexion réseau. Aucun nouveau paquet n’est utilisé au runtime de l’application.

Aucune génération Runway payante, aucun compte, message, paiement ou dossier réel de famille n’a été créé pour ces médias.
