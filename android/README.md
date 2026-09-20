# Taskinator — appli Android (v1)

Appli native Kotlin + Jetpack Compose, connectée au même projet Supabase que
l'appli web (`agnes-me/Taskinator`), avec un widget d'écran d'accueil.

## Important — build local requis

Cet écosystème (session Claude Code) n'a pas accès au réseau vers les serveurs
Google (`dl.google.com`) qui distribuent le SDK Android : impossible d'y
compiler un APK. Ce dossier contient le **code source complet, prêt à build**,
mais tu dois l'ouvrir dans Android Studio (ou lancer Gradle) sur une machine
avec un accès internet normal pour obtenir l'APK.

### Étapes

1. Installer [Android Studio](https://developer.android.com/studio) (dernière version stable).
2. `Ouvrir un projet existant` → sélectionner le dossier `android/`.
3. Laisser Android Studio télécharger le SDK/Gradle nécessaires (il proposera
   sans doute de mettre à jour l'Android Gradle Plugin / Kotlin vers ses
   dernières versions connues — accepte, les versions ici datent de la
   rédaction de ce projet).
4. `Run ▶` sur un émulateur ou un téléphone branché pour un APK debug, ou
   `Build > Generate Signed Bundle / APK` pour un APK release signé.
5. Pour tester le widget : rester appuyé sur l'écran d'accueil Android →
   Widgets → Taskinator → glisser « Mes tâches Taskinator ».

## Ce qui fonctionne (v1)

- Connexion (e-mail + mot de passe) au même compte que sur le web.
- Tableau de bord : mes tâches à venir (7 prochains jours, assignées à moi),
  liste des conteneurs.
- Liste des tâches d'un conteneur, avec case à cocher pour les valider.
- **Widget d'écran d'accueil** : mes tâches à venir, case à cocher directement
  depuis le widget (sans ouvrir l'appli), tap sur le widget pour ouvrir
  l'appli. Rafraîchi automatiquement toutes les ~30 min, et immédiatement
  après une connexion ou une tâche cochée dans l'appli.

## Ce qui n'est pas dans ce v1 (reste web-only pour l'instant)

- Création de compte / invitations / gestion des membres.
- Templates de pièces et d'événements, marketplace, modération.
- Événements / rétroplanning, calendrier, filtres par catégorie.
- Sous-tâches, pause, pièce jointe photo à la complétion, dégradé de thème.
- Ajout/édition de tâches depuis le mobile (lecture + complétion seulement).

Ces écrans restent accessibles via le web (qui fonctionne aussi comme PWA
installable sur Android — voir la page Réglages de l'appli web).

## Choix techniques

- **Pas du SDK officiel Supabase** : appels REST directs (Auth `/auth/v1` +
  PostgREST `/rest/v1`) via OkHttp, pour éviter une dépendance dont je n'ai
  pas pu vérifier la compatibilité de version dans cet environnement sans
  accès réseau ni build possible.
- **DataStore Preferences** (non chiffré) pour stocker la session — à
  durcir avec `androidx.security` (Keystore) avant une vraie mise en
  production, la clé anon est publique et protégée par les policies RLS
  mais les tokens de session utilisateur méritent un stockage chiffré.
- **Glance** (`androidx.glance:glance-appwidget`) pour le widget — Compose
  pour App Widgets, remplace l'ancien système de `RemoteViews` XML.
- **WorkManager** pour le rafraîchissement périodique du widget en tâche de
  fond (l'intervalle minimum autorisé par Android pour du travail périodique
  est 15 min ; ce projet utilise 30 min pour ménager la batterie).
- Aucune dépendance à Hilt/Dagger : un petit conteneur manuel
  (`AppContainer` dans `TaskinatorApplication.kt`) suffit pour ce périmètre.

## Config Supabase

L'URL et la clé anon (publique, protégée par RLS — comme
`NEXT_PUBLIC_SUPABASE_ANON_KEY` côté web) sont dans
`app/build.gradle.kts` (`buildConfigField`). Si le projet Supabase change,
mets ces deux valeurs à jour à cet endroit.

## Prochaines étapes suggérées

1. Ouvrir dans Android Studio, laisser l'assistant de mise à jour des
   versions Gradle/AGP/Kotlin faire son travail, corriger les éventuels
   warnings de dépréciation mineurs qui apparaîtront avec le temps.
2. Tester sur un vrai téléphone (le widget Glance a quelques différences
   de rendu selon les launchers Android — Pixel/Samsung/etc.).
3. Remplacer le stockage de session par `androidx.security` (chiffré).
4. Étendre le widget pour permettre de choisir un conteneur précis à
   afficher (actuellement : toujours « mes tâches » tous conteneurs
   confondus).
