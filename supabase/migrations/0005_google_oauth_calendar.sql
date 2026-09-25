-- Connexion Google Calendar en OAuth (en plus des abonnements iCal en lecture seule existants) :
-- permet de voir ET modifier les événements d'un agenda Google avec le consentement de
-- l'utilisateur, et de déverser automatiquement les tâches d'un conteneur vers un agenda Google
-- choisi. Jetons stockés en clair comme le reste du schéma (pas de chiffrement applicatif ailleurs
-- dans ce projet) : la protection vient de la RLS, jamais exposés côté client (lus uniquement
-- depuis des Server Actions/Route Handlers).

create table google_oauth_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agendas Google que l'utilisateur a choisi d'afficher (parmi ceux renvoyés par calendarList.list),
-- avec la même personnalisation couleur/visibilité que les abonnements iCal.
create table google_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_calendar_id text not null,
  label text not null,
  color text not null default '#0ea5e9',
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, google_calendar_id)
);

-- Déversement automatique des tâches d'un conteneur vers un agenda Google choisi. synced_by
-- désigne le compte Google (google_oauth_accounts) dont le jeton sert à pousser les événements —
-- forcément un membre du conteneur, vérifié à l'écriture par la policy container_role.
create table container_google_sync (
  container_id uuid primary key references containers(id) on delete cascade,
  synced_by uuid not null references auth.users(id) on delete cascade,
  google_calendar_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Correspondance tâche -> événement Google poussé, pour pouvoir le mettre à jour/marquer fait au
-- lieu d'en recréer un à chaque modification.
create table task_google_events (
  task_id uuid primary key references tasks(id) on delete cascade,
  container_id uuid not null references containers(id) on delete cascade,
  google_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table google_oauth_accounts enable row level security;
-- Le token du compte reste lisible par son propriétaire, et aussi par les autres membres d'un
-- conteneur que ce compte synchronise (container_google_sync.synced_by) : le déversement d'une
-- tâche déclenché par n'importe quel membre a besoin de pouvoir lire ce token sans clé service_role.
create policy google_oauth_accounts_select on google_oauth_accounts for select using (
  user_id = auth.uid()
  or exists (
    select 1 from container_google_sync cgs
    where cgs.synced_by = google_oauth_accounts.user_id and is_container_member(cgs.container_id)
  )
);
create policy google_oauth_accounts_insert on google_oauth_accounts for insert with check (user_id = auth.uid());
create policy google_oauth_accounts_update on google_oauth_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy google_oauth_accounts_delete on google_oauth_accounts for delete using (user_id = auth.uid());

alter table google_calendars enable row level security;
create policy google_calendars_select on google_calendars for select using (user_id = auth.uid());
create policy google_calendars_insert on google_calendars for insert with check (user_id = auth.uid());
create policy google_calendars_update on google_calendars for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy google_calendars_delete on google_calendars for delete using (user_id = auth.uid());

alter table container_google_sync enable row level security;
create policy container_google_sync_select on container_google_sync for select using (is_container_member(container_id));
create policy container_google_sync_insert on container_google_sync for insert with check (
  container_role(container_id) in ('admin', 'member') and synced_by = auth.uid()
);
create policy container_google_sync_update on container_google_sync for update using (
  container_role(container_id) in ('admin', 'member')
) with check (
  container_role(container_id) in ('admin', 'member') and synced_by = auth.uid()
);
create policy container_google_sync_delete on container_google_sync for delete using (container_role(container_id) in ('admin', 'member'));

alter table task_google_events enable row level security;
create policy task_google_events_select on task_google_events for select using (is_container_member(container_id));
create policy task_google_events_all on task_google_events for all using (
  container_role(container_id) in ('admin', 'member')
) with check (
  container_role(container_id) in ('admin', 'member')
);
