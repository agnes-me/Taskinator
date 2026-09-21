# Taskinator — appli Android (v1)

Appli native Kotlin + Jetpack Compose, connectée au même projet Supabase que
l'appli web (`agnes-me/Taskinator`), avec trois widgets d'écran d'accueil.

## Comment obtenir un APK

Cet environnement (session Claude Code) n'a pas accès au réseau vers les
serveurs Google (`dl.google.com`) qui distribuent le SDK Android : impossible
d'y compiler un APK, quel que soit le code présent. Deux façons d'en obtenir
un quand même :

### Option A — GitHub Actions (le plus simple, aucune installation)

Le dépôt contient `.github/workflows/android-build.yml` : il compile l'APK
debug à chaque push sur cette branche qui touche `android/`, sur les
machines de GitHub (qui, elles, ont un accès réseau normal), et le dépose en
pièce jointe téléchargeable du run.

1. Sur GitHub → onglet **Actions** → workflow **Android build** → le run le
   plus récent pour cette branche.
2. En bas de la page du run, section **Artifacts** → télécharger
   `taskinator-debug-apk` (un .zip contenant le .apk).
3. Sur le téléphone Android : autoriser l'installation depuis une source
   inconnue si demandé, puis ouvrir le .apk téléchargé pour l'installer.

Tu peux aussi déclencher un build à la demande sans push : onglet Actions →
Android build → **Run workflow**.

### Option B — Android Studio en local

1. Installer [Android Studio](https://developer.android.com/studio).
2. `Ouvrir un projet existant` → sélectionner le dossier `android/`.
3. Laisser Android Studio télécharger le SDK/Gradle nécessaires (il proposera
   sans doute de mettre à jour l'Android Gradle Plugin / Kotlin vers ses
   dernières versions connues — accepte, les versions ici datent de la
   rédaction de ce projet).
4. `Run ▶` sur un émulateur ou un téléphone branché pour un APK debug, ou
   `Build > Generate Signed Bundle / APK` pour un APK release signé.

Pour tester un widget une fois l'appli installée : rester appuyé sur l'écran
d'accueil Android → Widgets → Taskinator → glisser le widget voulu.

## Ce qui fonctionne (v1)

- Connexion (e-mail + mot de passe) au même compte que sur le web.
- Tableau de bord : mes tâches à venir (7 prochains jours, assignées à moi),
  liste des conteneurs, lien vers la connexion Google Calendar.
- Liste des tâches d'un conteneur, avec case à cocher pour les valider.
- **Widget « Mes tâches »** : tâches à venir, case à cocher directement
  depuis le widget (sans ouvrir l'appli), tap sur le widget pour ouvrir
  l'appli.
- **Widget « Liste filtrable »** : à la pose, choisis un conteneur (ou tous)
  et, dans ce conteneur, une catégorie (ou toutes) ; le widget affiche ce
  sous-ensemble trié par importance puis par échéance, avec case à cocher.
- **Widget « Calendrier »** : tes tâches Taskinator à échéance proche,
  fusionnées avec les événements de tous tes agendas Google Calendar (si
  connecté), triées chronologiquement. Lecture seule côté Google ; case à
  cocher pour les tâches Taskinator.
- Les trois widgets ont un fond sombre translucide (pour se fondre dans le
  fond d'écran) ; le degré de transparence se règle dans l'appli, bouton 🎨
  en haut du tableau de bord — le changement s'applique en quelques
  secondes aux widgets déjà posés.
- Tous les widgets se rafraîchissent automatiquement (~30 min) et
  immédiatement après une connexion ou une tâche cochée dans l'appli.

## Ce qui n'est pas dans ce v1 (reste web-only pour l'instant)

- Création de compte / invitations / gestion des membres.
- Templates de pièces et d'événements, marketplace, modération.
- Retroplanning d'événement, vue calendrier mois/semaine avec glisser-
  déposer (le widget Calendrier est une liste chronologique, pas une grille).
- Sous-tâches, pause, pièce jointe photo à la complétion, dégradé de thème.
- Ajout/édition de tâches depuis le mobile (lecture + complétion seulement).

Ces écrans restent accessibles via le web (qui fonctionne aussi comme PWA
installable sur Android — voir la page Réglages de l'appli web).

## Connecter Google Calendar (nécessaire pour le widget Calendrier)

Le widget Calendrier fonctionne sans Google (il affiche alors juste les
tâches Taskinator), mais pour fusionner tes agendas Google il faut créer un
identifiant OAuth côté Google Cloud — une étape que je ne peux pas faire à
ta place, elle se passe entièrement sur ton compte Google.

1. Va sur [console.cloud.google.com](https://console.cloud.google.com/),
   crée un projet (ou choisis-en un existant).
2. **APIs et services → Bibliothèque** → cherche « Google Calendar API » →
   Activer.
3. **APIs et services → Écran de consentement OAuth** :
   - Type d'utilisateur : Externe (sauf si tu as un Google Workspace).
   - Renseigne un nom d'appli, un e-mail de support et de contact.
   - Dans « Utilisateurs test », ajoute ton propre compte Gmail (obligatoire
     tant que l'appli n'est pas validée par Google — sinon la connexion
     échoue avec une erreur d'accès refusé).
4. **APIs et services → Identifiants → Créer des identifiants → ID client
   OAuth** :
   - Type d'application : **Android**.
   - Nom du package : `com.taskinator.app`
   - Empreinte du certificat SHA-1 :
     ```
     66:90:32:C0:9F:44:5D:DA:AB:90:F5:4F:84:45:22:72:B0:45:1E:D0
     ```
     (c'est l'empreinte de `android/keystore/debug.keystore`, committée dans
     ce dépôt et utilisée pour **tous** les builds debug — Android Studio
     comme GitHub Actions — donc cette valeur ne change jamais tant que ce
     fichier n'est pas régénéré. Si tu builds un jour un APK **release**
     avec ta propre clé de signature, il te faudra créer un second ID client
     OAuth avec le SHA-1 de cette clé-là.)
5. Valide. Aucune clé/secret à coller dans le code : l'API Authorization de
   Play Services associe automatiquement la demande au bon client OAuth via
   le nom de package + le SHA-1 de l'APK qui l'appelle, il n'y a rien à
   configurer côté app.
6. Dans l'appli (une fois installée) : bouton 🗓️ en haut du tableau de bord
   → « Connecter Google Calendar » → accepter le consentement. Le widget se
   met à jour au rafraîchissement suivant (ou immédiatement après connexion).

Tant que l'appli reste en mode test sur l'écran de consentement (étape 3),
seuls les comptes ajoutés comme « utilisateurs test » peuvent se connecter —
suffisant pour un usage personnel/familial ; publier l'écran de consentement
pour un usage plus large est une étape séparée, plus lourde (vérification
Google), à envisager seulement si besoin.

## Choix techniques

- **Pas du SDK officiel Supabase** : appels REST directs (Auth `/auth/v1` +
  PostgREST `/rest/v1`) via OkHttp, pour éviter une dépendance dont je n'ai
  pas pu vérifier la compatibilité de version dans cet environnement sans
  accès réseau ni build possible.
- **DataStore Preferences** (non chiffré) pour stocker la session — à
  durcir avec `androidx.security` (Keystore) avant une vraie mise en
  production, la clé anon est publique et protégée par les policies RLS
  mais les tokens de session utilisateur méritent un stockage chiffré.
- **Glance** (`androidx.glance:glance-appwidget`) pour les widgets — Compose
  pour App Widgets, remplace l'ancien système de `RemoteViews` XML.
- **API Authorization de Google Play Services** (`play-services-auth`) pour
  Google Calendar plutôt que l'ancien GoogleSignIn — autorisation
  incrémentale (juste le scope `calendar.readonly`), pas de jeton stocké
  côté app : chaque rafraîchissement redemande silencieusement un jeton
  frais une fois le consentement initial donné.
- **WorkManager** pour le rafraîchissement périodique des widgets en tâche
  de fond (l'intervalle minimum autorisé par Android pour du travail
  périodique est 15 min ; ce projet utilise 30 min pour ménager la
  batterie).
- **Keystore de debug committée** (`android/keystore/debug.keystore`) au
  lieu de celle, auto-générée et donc différente à chaque machine/run CI,
  que Gradle utiliserait sinon — indispensable pour que l'ID client OAuth
  Google (lié au SHA-1) reste valide quel que soit l'endroit où l'APK debug
  est compilé.
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
   de rendu selon les launchers Android — Pixel/Samsung/etc.) et vérifier
   le flux de connexion Google Calendar de bout en bout (seule partie du
   code que je n'ai pas pu valider par compilation CI faute de pouvoir
   déclencher un vrai flux de consentement depuis cette session).
3. Remplacer le stockage de session par `androidx.security` (chiffré).
4. Si besoin d'un usage au-delà du cercle familial : publier l'écran de
   consentement OAuth Google (sort du mode test).
