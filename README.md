# Taskinator

Application de gestion de tâches et de ménage, multi-foyer dès le départ : des **conteneurs**
(Perso, Pro, Maison principale, Maison secondaire…) avec rôles admin/membre/invité, des
tâches récurrentes avec sous-tâches et indicateur de propreté dégressif (façon Tody/Sweepy),
des templates de pièce et d'événement (rétroplanning) partageables via une marketplace
modérée, et une interface web claire/sombre avec thème de couleur par conteneur.

Ce dépôt est une reconstruction complète (v2) à partir d'un cahier des charges détaillé,
en remplacement d'une première version plus sommaire (Prisma/NextAuth).

## Stack technique

- **Next.js 16** (App Router, Server Actions) + TypeScript + Tailwind CSS
- **Supabase** : Postgres managé, auth, Row Level Security (isolation multi-tenant),
  Realtime (à activer en Phase suivante pour la synchro temps réel), Storage (photos de
  complétion des tâches)
- Déploiement gratuit visé : Vercel/Netlify/Cloudflare Pages (web) + Supabase (offre gratuite)

Aucune dépendance payante n'est requise pour développer et utiliser l'application telle
qu'elle est aujourd'hui.

## Démarrer en local

1. Créer un projet gratuit sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter le contenu de `supabase/migrations/0001_init.sql`
   (schéma complet : tables, RLS, triggers, fonctions RPC, bucket de stockage).
3. Copier `.env.example` en `.env.local` et renseigner :
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (uniquement pour le script de seed, jamais exposée au client)
   - `NEXT_PUBLIC_ADMIN_EMAIL` (l'administratrice principale de la marketplace)
4. Installer les dépendances et importer la bibliothèque de templates système (28 pièces,
   232 tâches types — cuisine, salle de bain, jardin, véhicule…) :

   ```bash
   npm install
   npm run db:seed-templates
   npm run dev
   ```

5. Ouvrir `http://localhost:3000`, créer un compte (Supabase Auth envoie un e-mail de
   confirmation), puis suivre l'onboarding pour créer votre premier foyer et conteneur.

## Modèle de données (`supabase/migrations/0001_init.sql`)

- **Foyer (`households`)** : unité d'isolation la plus haute (RLS stricte, aucune fuite
  entre foyers).
- **Conteneur (`containers`)** : espace de tâches cloisonné avec ses propres membres et
  rôles (`container_members.role` : `admin` / `member` / `guest`), sa couleur de thème,
  sa pause globale (vacances).
- **Pièces (`rooms`)** : listes par zone de la maison, avec durée de validité (`freshness_days`)
  et pause propre.
- **Tâches (`tasks`)** : récurrence, priorité, échéance et time-blocking optionnel
  (`start_at`/`duration_minutes`/`on_calendar`), sous-tâches sur 2 niveaux
  (`parent_task_id`), saisonnalité, pause, historique de complétion avec photo/commentaire
  (`task_completions`, stockage Supabase Storage bucket `task-photos`).
- **Templates (`room_templates`/`event_templates` + `*_items`)** : personnels, partagés
  dans un conteneur, ou publiés dans la **marketplace** publique après **modération
  manuelle** (le champ `moderation_status` passe à `pending` à la publication ; seule
  l'administratrice — `NEXT_PUBLIC_ADMIN_EMAIL` — peut approuver/refuser, page
  `/admin/moderation`).
- **Droits** : appliqués par Row Level Security au niveau ligne (pas seulement côté
  interface). Un trigger dédié (`enforce_task_update_rules`) restreint les invité·e·s à ne
  modifier que le statut des tâches qui leur sont assignées — la table `container_members`
  isole déjà chaque conteneur, ce qui permettra d'affiner ces droits par tâche/liste plus
  tard sans refonte du schéma.

## Ce qui est implémenté (Phases 0, 1, et une bonne partie de la Phase 2)

- Authentification (Supabase Auth), onboarding foyer + conteneur
- Conteneurs multiples, rôles, invitations par lien (avec expiration)
- Pièces avec indicateur de propreté dégressif (vert → orange → rouge), pause et
  saisonnalité gelant l'indicateur
- Tâches : récurrence (quotidienne/hebdo/mensuelle/personnalisée), priorité, assignation
  multiple, sous-tâches (2 niveaux), pause, complétion avec commentaire + photo
- Templates de pièce : bibliothèque système pré-remplie, templates personnels/partagés,
  duplication, application en un clic, publication + modération marketplace
- Templates d'événement avec rétroplanning (décalage en jours J-30/J-7/J+1…), génération
  automatique des tâches datées
- Tableau de bord multi-conteneurs, mode sombre natif, thème de couleur par conteneur,
  design responsive (mobile + web)

## Ce qui n'est **pas** implémenté (hors de portée d'une session de code)

Le cahier des charges vise une application native Android et un serveur calendrier
auto-hébergé — deux chantiers distincts qui demandent des outils que cet environnement de
développement n'a pas (SDK Android, accès à votre NAS/Raspberry Pi) :

- **Application Android native** (Kotlin + Jetpack Compose) et widgets Glance — l'appli web
  actuelle est responsive et installable en PWA en attendant, mais ce n'est pas un
  remplacement du natif prévu en Phase 4 de la roadmap.
- **Calendrier CalDAV bidirectionnel** (serveur Radicale auto-hébergé + synchronisation) —
  le modèle de données prévoit déjà la bascule tâche/événement (`on_calendar`, `start_at`,
  `duration_minutes`) pour ne pas avoir à le refondre quand ce chantier sera lancé.
- **Notifications push** (Firebase Cloud Messaging) et **rappels**.
- **E-mail de modération automatique** à la publication d'un template — nécessite une clé
  API d'un service mail (Resend, Postmark…) non configurée ici ; en attendant, consultez
  `/admin/moderation` régulièrement.
- **Synchronisation temps réel** entre membres (les canaux Realtime de Supabase sont prêts
  côté base, mais pas encore branchés côté client — actuellement il faut rafraîchir la page).
- **Droits fins par tâche/liste** au-delà du rôle par conteneur (prévu non prioritaire en v1
  par le cahier des charges lui-même).

## Scripts utiles

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript seule |
| `npm run db:seed-templates` | (Ré)importe la bibliothèque de templates système |

## Déploiement

- **Web** : Vercel/Netlify/Cloudflare Pages, variables d'env identiques à `.env.local`
  (sans `SUPABASE_SERVICE_ROLE_KEY`, réservée au seed local).
- **Base** : le projet Supabase créé plus haut ; au-delà des paliers gratuits, coût
  symbolique seulement en cas de forte croissance d'usage.
