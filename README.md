# Taskinator

Application de gestion de tâches partagées en équipe (foyer) : ménage récurrent par zone
(façon Sweepy), courses, valises, et rétroplanning d'évènements à partir de templates
personnalisables.

## Stack technique

- **Next.js 16** (App Router, Server Actions) + TypeScript
- **Prisma** + **PostgreSQL** (une base gratuite Render/Neon/Supabase suffit pour tester)
- **NextAuth** (Credentials) pour l'authentification
- **Tailwind CSS** pour l'interface
- Manifest PWA (installable sur mobile, en attendant une vraie application native)

## Concepts principaux

- **Foyer (Household)** : l'équipe qui partage ses listes. On le crée ou on le rejoint avec
  un code d'invitation.
- **Profils** : les membres du foyer, y compris les enfants qui n'ont pas de compte de
  connexion. Utilisés pour assigner des tâches et personnaliser les templates (ex : une
  valise par enfant).
- **Zones** : les pièces/zones de la maison (Cuisine, Salle de bain...), rattachées aux
  tâches de ménage.
- **Catégories** : Ménage, Courses, Valises, Évènements, Administratif, Autre.
- **Tâches** : titre, catégorie, zone, assigné, priorité, échéance, et une **périodicité**
  (ponctuelle, quotidienne, hebdomadaire avec jours précis, mensuelle, intervalle
  personnalisé) — à la manière de Sweepy. Une tâche récurrente terminée recalcule
  automatiquement sa prochaine échéance.
- **Pause des rappels** : au niveau d'une tâche (ex : travaux, absence ponctuelle) ou de
  tout le foyer (vacances) — dans les deux cas avec une date de fin et une raison
  optionnelle.
- **Templates** : listes types réutilisables et personnalisables.
  - Type *Liste simple* (ex : valise de vacances) : chaque élément peut être marqué
    « par personne » pour générer une tâche par membre sélectionné.
  - Type *Rétroplanning* (ex : recevoir des invités, courses pour un repas) : chaque
    élément a un décalage en jours (`offsetDays`) par rapport à une date d'évènement.
    En instanciant le template sur une date donnée, toutes les tâches sont générées avec
    leur échéance calculée automatiquement (J-14, J-7, J-1, jour J...).
- **Évènements** : l'occasion concrète (nom + date) sur laquelle un template est appliqué ;
  regroupe les tâches générées.
- **Calendrier** : chaque foyer a un flux ICS (`/api/calendar/{householdId}/{token}.ics`)
  abonnable depuis Google Calendar, Apple Calendar ou Outlook, et chaque tâche datée a un
  lien direct « Ajouter à Google Calendar ».

## Démarrer en local

```bash
npm install
cp .env.example .env      # renseigner DATABASE_URL (Postgres local, Docker, ou Render/Neon/Supabase)
npm run db:push           # crée les tables à partir du schéma
npm run db:seed           # jeu de données de démo (voir identifiants ci-dessous)
npm run dev
```

Compte de démo créé par le seed : `demo@taskinator.local` / `demo1234`.

### Scripts utiles

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (génère le client Prisma + build Next.js) |
| `npm run db:migrate` | Migration Prisma (dev) |
| `npm run db:push` | Synchronise le schéma sans migration (pratique en local) |
| `npm run db:seed` | Jeu de données de démonstration |

### Déploiement (testé sur Render)

- Un service web Node (`npm install && npx prisma generate && npx prisma db push && npm run build`
  comme build command, `npm start` comme start command)
- Une base Postgres (gratuite pour tester), reliée via `DATABASE_URL`
- Variables d'env : `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (l'URL publique du
  service)

Note : les champs "enum" (priorité, statut, périodicité...) sont stockés en `String` dans
le schéma (choix fait pour rester compatible SQLite en local si besoin) ; les valeurs
valides sont documentées dans `src/lib/types.ts`.

## Roadmap

Ce dépôt couvre la version web (utilisable dès maintenant, avec un manifest PWA pour
l'installer sur l'écran d'accueil d'un téléphone). Les prochaines étapes vers l'usage
cible décrit par l'utilisateur :

1. **Application mobile native avec widgets**
   - Un client React Native / Expo (ou Kotlin/Swift natifs) consommant les mêmes routes
     API que le web (à extraire proprement en API REST/JSON dédiée si besoin, au-delà des
     Server Actions actuelles qui sont spécifiques à Next.js).
   - Widgets iOS (WidgetKit) / Android (App Widgets) affichant les tâches du jour et
     permettant de cocher une tâche sans ouvrir l'application.
   - Notifications push natives pour les rappels (au lieu du flux ICS uniquement).

2. **Synchronisation Google Calendar bidirectionnelle**
   - Le flux ICS actuel est un abonnement en lecture (Google/Apple/Outlook peuvent
     l'ajouter). Pour une vraie intégration bidirectionnelle (créer/modifier un évènement
     Google Calendar qui remonte dans Taskinator), il faut implémenter OAuth Google
     (Google Calendar API), stocker les tokens par utilisateur, et gérer la synchronisation
     dans les deux sens.

3. **Notifications & rappels proactifs**
   - Aujourd'hui, la pause des rappels est gérée mais l'envoi actif de rappels (email/push)
     n'est pas implémenté : à ajouter via une tâche planifiée (cron) qui regarde les tâches
     à échéance proche et non « pausées ».

4. **Historique & statistiques**
   - Le modèle `TaskCompletion` trace déjà qui a fait quoi et quand ; une page de
     statistiques par membre/zone/catégorie serait une suite naturelle.

5. **Templates partagés/système**
   - Le modèle prévoit des templates globaux (`householdId` nul, `isSystem`) pour proposer
     une bibliothèque de templates prêts à l'emploi au-delà de ceux créés par chaque foyer.
