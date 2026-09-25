-- Taskinator — schéma initial (multi-tenant : foyers > conteneurs > pièces > tâches)
-- Isolation stricte entre foyers et entre conteneurs via Row Level Security (RLS).

create extension if not exists pgcrypto;

-- =========================================================================
-- 1. TABLES
-- =========================================================================

-- auth.users n'est pas exposée à l'API : ce profil léger (synchronisé automatiquement à
-- l'inscription) permet d'afficher noms/e-mails des membres dans les conteneurs partagés.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_color text not null default '#14b8a6',
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table containers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default '🏠',
  color text not null default '#14b8a6',
  paused_until timestamptz,
  pause_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table container_members (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  created_at timestamptz not null default now(),
  unique (container_id, user_id)
);

create table container_invitations (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  email text,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  name text not null,
  icon text not null default '🧹',
  color text,
  freshness_days integer not null default 7,
  sort_order integer not null default 0,
  paused_until timestamptz,
  pause_reason text,
  created_at timestamptz not null default now()
);

create table room_templates (
  id uuid primary key default gen_random_uuid(),
  owner_container_id uuid references containers(id) on delete cascade,
  created_by uuid references auth.users(id),
  name text not null,
  icon text not null default '🧹',
  is_system boolean not null default false,
  visibility text not null default 'personal' check (visibility in ('personal', 'container', 'public')),
  moderation_status text not null default 'approved' check (moderation_status in ('draft', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table room_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references room_templates(id) on delete cascade,
  title text not null,
  description text,
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'custom_days')),
  recurrence_interval integer not null default 1,
  recurrence_weekdays text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  freshness_days integer,
  sort_order integer not null default 0
);

create table event_templates (
  id uuid primary key default gen_random_uuid(),
  owner_container_id uuid references containers(id) on delete cascade,
  created_by uuid references auth.users(id),
  name text not null,
  icon text not null default '🎉',
  is_system boolean not null default false,
  visibility text not null default 'personal' check (visibility in ('personal', 'container', 'public')),
  moderation_status text not null default 'approved' check (moderation_status in ('draft', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table event_template_items (
  id uuid primary key default gen_random_uuid(),
  event_template_id uuid not null references event_templates(id) on delete cascade,
  title text not null,
  description text,
  offset_days integer not null default 0,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'custom_days')),
  sort_order integer not null default 0
);

create table events (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  name text not null,
  event_date date not null,
  template_id uuid references event_templates(id) on delete set null,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'custom_days')),
  recurrence_interval integer not null default 1,
  recurrence_weekdays text,
  due_date date,
  start_at timestamptz,
  duration_minutes integer,
  on_calendar boolean not null default false,
  freshness_days integer,
  last_completed_at timestamptz,
  completion_mode text not null default 'manual' check (completion_mode in ('manual', 'auto_from_subtasks')),
  seasonal_start_month smallint check (seasonal_start_month between 1 and 12),
  seasonal_end_month smallint check (seasonal_end_month between 1 and 12),
  paused_until timestamptz,
  pause_reason text,
  source_template_item_id uuid references room_template_items(id) on delete set null,
  source_event_id uuid references events(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  completed_by uuid not null references auth.users(id),
  completed_at timestamptz not null default now(),
  comment text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index on household_members (user_id);
create index on containers (household_id);
create index on container_members (user_id);
create index on rooms (container_id);
create index on room_template_items (template_id);
create index on event_template_items (event_template_id);
create index on events (container_id);
create index on tasks (container_id, status);
create index on tasks (room_id);
create index on tasks (parent_task_id);
create index on task_assignees (user_id);
create index on task_completions (task_id, completed_at desc);

-- =========================================================================
-- 2. FONCTIONS UTILITAIRES (utilisées par les policies RLS)
-- =========================================================================

create function public.container_role(cid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from container_members where container_id = cid and user_id = auth.uid();
$$;

create function public.is_container_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select container_role(cid) is not null;
$$;

create function public.is_container_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select container_role(cid) = 'admin';
$$;

create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

create function public.is_super_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'agnes.mechoulam@gmail.com';
$$;

create function public.room_template_visible(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_templates rt
    where rt.id = tid
      and (
        rt.is_system
        or (rt.visibility = 'public' and rt.moderation_status = 'approved')
        or (rt.visibility = 'container' and rt.owner_container_id is not null and is_container_member(rt.owner_container_id))
        or (rt.visibility = 'personal' and rt.created_by = auth.uid())
        or is_super_admin()
      )
  );
$$;

create function public.room_template_editable(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_templates rt where rt.id = tid and rt.created_by = auth.uid()) or is_super_admin();
$$;

create function public.event_template_visible(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_templates et
    where et.id = tid
      and (
        et.is_system
        or (et.visibility = 'public' and et.moderation_status = 'approved')
        or (et.visibility = 'container' and et.owner_container_id is not null and is_container_member(et.owner_container_id))
        or (et.visibility = 'personal' and et.created_by = auth.uid())
        or is_super_admin()
      )
  );
$$;

create function public.event_template_editable(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_templates et where et.id = tid and et.created_by = auth.uid()) or is_super_admin();
$$;

create function public.compute_next_due_date(p_type text, p_interval integer, p_weekdays text, p_from date) returns date
language plpgsql immutable as $$
declare
  interval_n integer := greatest(1, coalesce(p_interval, 1));
  wanted int[];
  d date;
  iso_day int;
  i int;
begin
  if p_type is null or p_type = 'none' then
    return null;
  elsif p_type = 'daily' or p_type = 'custom_days' then
    return p_from + interval_n;
  elsif p_type = 'weekly' then
    if p_weekdays is not null and length(trim(p_weekdays)) > 0 then
      select array_agg(x::int) into wanted from unnest(string_to_array(p_weekdays, ',')) x where trim(x) ~ '^[0-9]+$';
      if wanted is not null and array_length(wanted, 1) > 0 then
        for i in 1..14 loop
          d := p_from + i;
          iso_day := extract(isodow from d);
          if iso_day = any(wanted) then
            return d;
          end if;
        end loop;
      end if;
      return p_from + 7;
    end if;
    return p_from + (interval_n * 7);
  elsif p_type = 'monthly' then
    return (p_from + (interval_n || ' months')::interval)::date;
  else
    return null;
  end if;
end;
$$;

-- =========================================================================
-- 3. TRIGGERS
-- =========================================================================

-- Synchronise un profil léger (email, nom) à chaque inscription, pour affichage dans les
-- listes de membres sans exposer auth.users à l'API.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profondeur maximale des sous-tâches : 2 niveaux (tâche -> sous-tâche).
create function public.enforce_subtask_depth() returns trigger language plpgsql as $$
declare
  parent_is_top_level boolean;
begin
  if NEW.parent_task_id is not null then
    if NEW.parent_task_id = NEW.id then
      raise exception 'Une tâche ne peut pas être sa propre sous-tâche';
    end if;
    select (parent_task_id is null) into parent_is_top_level from tasks where id = NEW.parent_task_id;
    if parent_is_top_level is null then
      raise exception 'Tâche parente introuvable';
    elsif not parent_is_top_level then
      raise exception 'Profondeur maximale de sous-tâches atteinte (2 niveaux)';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_enforce_subtask_depth
  before insert or update of parent_task_id on tasks
  for each row execute function enforce_subtask_depth();

-- Un invité (guest) ne peut modifier que le statut d'une tâche qui lui est assignée
-- (avec commentaire/photo via task_completions) ; tous les autres champs sont protégés.
create function public.enforce_task_update_rules() returns trigger language plpgsql as $$
declare
  v_role text;
  v_is_assignee boolean;
begin
  v_role := container_role(NEW.container_id);
  if v_role = 'guest' then
    select exists (select 1 from task_assignees where task_id = NEW.id and user_id = auth.uid()) into v_is_assignee;
    if not v_is_assignee then
      raise exception 'Les invités ne peuvent modifier que les tâches qui leur sont assignées';
    end if;
    if NEW.title is distinct from OLD.title
      or NEW.description is distinct from OLD.description
      or NEW.room_id is distinct from OLD.room_id
      or NEW.priority is distinct from OLD.priority
      or NEW.recurrence_type is distinct from OLD.recurrence_type
      or NEW.recurrence_interval is distinct from OLD.recurrence_interval
      or NEW.recurrence_weekdays is distinct from OLD.recurrence_weekdays
      or NEW.start_at is distinct from OLD.start_at
      or NEW.duration_minutes is distinct from OLD.duration_minutes
      or NEW.on_calendar is distinct from OLD.on_calendar
      or NEW.freshness_days is distinct from OLD.freshness_days
      or NEW.completion_mode is distinct from OLD.completion_mode
      or NEW.seasonal_start_month is distinct from OLD.seasonal_start_month
      or NEW.seasonal_end_month is distinct from OLD.seasonal_end_month
      or NEW.parent_task_id is distinct from OLD.parent_task_id
      or NEW.container_id is distinct from OLD.container_id
      or NEW.paused_until is distinct from OLD.paused_until
      or NEW.pause_reason is distinct from OLD.pause_reason
      or NEW.sort_order is distinct from OLD.sort_order
    then
      raise exception 'Droits insuffisants pour modifier ces champs';
    end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_enforce_task_update_rules
  before update on tasks
  for each row execute function enforce_task_update_rules();

-- À chaque complétion : tâche ponctuelle -> "done" ; tâche récurrente -> "todo" avec la
-- prochaine échéance calculée (façon Tody/Sweepy), et mise à jour de last_completed_at
-- pour l'indicateur de fraîcheur/propreté.
create function public.after_task_completion() returns trigger language plpgsql as $$
declare
  v_task tasks%rowtype;
  v_next date;
begin
  select * into v_task from tasks where id = NEW.task_id;
  if v_task.recurrence_type is null or v_task.recurrence_type = 'none' then
    update tasks set status = 'done', last_completed_at = NEW.completed_at where id = NEW.task_id;
  else
    v_next := compute_next_due_date(v_task.recurrence_type, v_task.recurrence_interval, v_task.recurrence_weekdays, coalesce(NEW.completed_at::date, current_date));
    update tasks set status = 'todo', last_completed_at = NEW.completed_at, due_date = v_next where id = NEW.task_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_after_task_completion
  after insert on task_completions
  for each row execute function after_task_completion();

-- La modération (approbation/rejet) de la marketplace est réservée à l'administratrice ;
-- passer un template en public doit systématiquement transiter par le statut "pending".
create function public.guard_template_moderation() returns trigger language plpgsql as $$
begin
  if NEW.moderation_status is distinct from OLD.moderation_status
     and NEW.moderation_status in ('approved', 'rejected')
     and not is_super_admin() then
    raise exception 'Seule l''administratrice principale peut modérer les templates';
  end if;
  if NEW.visibility = 'public' and OLD.visibility <> 'public'
     and NEW.moderation_status <> 'pending' and not is_super_admin() then
    raise exception 'La publication dans la marketplace doit passer par la modération';
  end if;
  return NEW;
end;
$$;

create trigger trg_guard_room_template_moderation
  before update on room_templates
  for each row execute function guard_template_moderation();

create trigger trg_guard_event_template_moderation
  before update on event_templates
  for each row execute function guard_template_moderation();

-- =========================================================================
-- 4. ROW LEVEL SECURITY
-- =========================================================================

alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table containers enable row level security;
alter table container_members enable row level security;
alter table container_invitations enable row level security;
alter table rooms enable row level security;
alter table room_templates enable row level security;
alter table room_template_items enable row level security;
alter table event_templates enable row level security;
alter table event_template_items enable row level security;
alter table events enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table task_completions enable row level security;

-- profiles (lecture ouverte à toute utilisatrice connectée : nécessaire pour afficher les
-- membres des conteneurs partagés ; seule la propriétaire peut modifier son profil)
create policy profiles_select on profiles for select using (auth.uid() is not null);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- households
create policy households_select on households for select using (is_household_member(id));
create policy households_insert on households for insert with check (auth.uid() is not null);
create policy households_update on households for update using (is_household_member(id)) with check (is_household_member(id));

-- household_members
create policy household_members_select on household_members for select using (is_household_member(household_id));
create policy household_members_insert on household_members for insert with check (user_id = auth.uid());
create policy household_members_delete on household_members for delete using (user_id = auth.uid());

-- containers
create policy containers_select on containers for select using (is_container_member(id));
create policy containers_insert on containers for insert with check (is_household_member(household_id));
create policy containers_update on containers for update using (is_container_admin(id)) with check (is_container_admin(id));
create policy containers_delete on containers for delete using (is_container_admin(id));

-- container_members
create policy container_members_select on container_members for select using (is_container_member(container_id));
create policy container_members_insert on container_members for insert with check (is_container_admin(container_id));
create policy container_members_update on container_members for update using (is_container_admin(container_id)) with check (is_container_admin(container_id));
create policy container_members_delete on container_members for delete using (is_container_admin(container_id) or user_id = auth.uid());

-- container_invitations (la validation par token passe par une fonction SECURITY DEFINER)
create policy container_invitations_select on container_invitations for select using (is_container_admin(container_id));
create policy container_invitations_insert on container_invitations for insert with check (is_container_admin(container_id) and created_by = auth.uid());
create policy container_invitations_update on container_invitations for update using (is_container_admin(container_id)) with check (is_container_admin(container_id));
create policy container_invitations_delete on container_invitations for delete using (is_container_admin(container_id));

-- rooms
create policy rooms_select on rooms for select using (is_container_member(container_id));
create policy rooms_insert on rooms for insert with check (container_role(container_id) in ('admin', 'member'));
create policy rooms_update on rooms for update using (container_role(container_id) in ('admin', 'member')) with check (container_role(container_id) in ('admin', 'member'));
create policy rooms_delete on rooms for delete using (container_role(container_id) in ('admin', 'member'));

-- room_templates
create policy room_templates_select on room_templates for select using (room_template_visible(id));
create policy room_templates_insert on room_templates for insert with check (
  created_by = auth.uid()
  and visibility in ('personal', 'container')
  and (visibility = 'personal' or (owner_container_id is not null and container_role(owner_container_id) in ('admin', 'member')))
);
create policy room_templates_update on room_templates for update using (room_template_editable(id)) with check (room_template_editable(id));
create policy room_templates_delete on room_templates for delete using (created_by = auth.uid());

-- room_template_items
create policy room_template_items_select on room_template_items for select using (room_template_visible(template_id));
create policy room_template_items_insert on room_template_items for insert with check (room_template_editable(template_id));
create policy room_template_items_update on room_template_items for update using (room_template_editable(template_id)) with check (room_template_editable(template_id));
create policy room_template_items_delete on room_template_items for delete using (room_template_editable(template_id));

-- event_templates
create policy event_templates_select on event_templates for select using (event_template_visible(id));
create policy event_templates_insert on event_templates for insert with check (
  created_by = auth.uid()
  and visibility in ('personal', 'container')
  and (visibility = 'personal' or (owner_container_id is not null and container_role(owner_container_id) in ('admin', 'member')))
);
create policy event_templates_update on event_templates for update using (event_template_editable(id)) with check (event_template_editable(id));
create policy event_templates_delete on event_templates for delete using (created_by = auth.uid());

-- event_template_items
create policy event_template_items_select on event_template_items for select using (event_template_visible(event_template_id));
create policy event_template_items_insert on event_template_items for insert with check (event_template_editable(event_template_id));
create policy event_template_items_update on event_template_items for update using (event_template_editable(event_template_id)) with check (event_template_editable(event_template_id));
create policy event_template_items_delete on event_template_items for delete using (event_template_editable(event_template_id));

-- events
create policy events_select on events for select using (is_container_member(container_id));
create policy events_insert on events for insert with check (container_role(container_id) in ('admin', 'member'));
create policy events_update on events for update using (container_role(container_id) in ('admin', 'member')) with check (container_role(container_id) in ('admin', 'member'));
create policy events_delete on events for delete using (container_role(container_id) in ('admin', 'member'));

-- tasks (les invités ont accès en select/update, restreints finement par le trigger ci-dessus)
create policy tasks_select on tasks for select using (is_container_member(container_id));
create policy tasks_insert on tasks for insert with check (container_role(container_id) in ('admin', 'member'));
create policy tasks_update on tasks for update using (is_container_member(container_id)) with check (is_container_member(container_id));
create policy tasks_delete on tasks for delete using (container_role(container_id) in ('admin', 'member'));

-- task_assignees
create policy task_assignees_select on task_assignees for select using (
  exists (select 1 from tasks t where t.id = task_id and is_container_member(t.container_id))
);
create policy task_assignees_insert on task_assignees for insert with check (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
);
create policy task_assignees_delete on task_assignees for delete using (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
);

-- task_completions (historique de complétion, avec photo/commentaire ; un invité ne peut
-- compléter que les tâches qui lui sont assignées)
create policy task_completions_select on task_completions for select using (
  exists (select 1 from tasks t where t.id = task_id and is_container_member(t.container_id))
);
create policy task_completions_insert on task_completions for insert with check (
  completed_by = auth.uid()
  and exists (
    select 1 from tasks t where t.id = task_id and (
      container_role(t.container_id) in ('admin', 'member')
      or (
        container_role(t.container_id) = 'guest'
        and exists (select 1 from task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
      )
    )
  )
);
create policy task_completions_delete on task_completions for delete using (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) = 'admin')
);

-- =========================================================================
-- 5. FONCTIONS RPC (actions composites côté client)
-- =========================================================================

create function public.create_household_with_container(
  p_household_name text,
  p_container_name text,
  p_container_icon text default '🏠',
  p_container_color text default '#14b8a6'
) returns table(household_id uuid, container_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_container_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;
  insert into households (name) values (p_household_name) returning id into v_household_id;
  insert into household_members (household_id, user_id) values (v_household_id, v_uid);
  insert into containers (household_id, name, icon, color, created_by)
    values (v_household_id, p_container_name, p_container_icon, p_container_color, v_uid)
    returning id into v_container_id;
  insert into container_members (container_id, user_id, role) values (v_container_id, v_uid, 'admin');
  return query select v_household_id, v_container_id;
end;
$$;

create function public.create_container(
  p_household_id uuid,
  p_name text,
  p_icon text default '🏠',
  p_color text default '#14b8a6'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_container_id uuid;
begin
  if v_uid is null or not is_household_member(p_household_id) then
    raise exception 'Accès refusé';
  end if;
  insert into containers (household_id, name, icon, color, created_by)
    values (p_household_id, p_name, p_icon, p_color, v_uid)
    returning id into v_container_id;
  insert into container_members (container_id, user_id, role) values (v_container_id, v_uid, 'admin');
  return v_container_id;
end;
$$;

create function public.accept_container_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv container_invitations%rowtype;
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;
  select * into v_inv from container_invitations where token = p_token;
  if v_inv.id is null then
    raise exception 'Invitation introuvable';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Invitation expirée';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Invitation déjà utilisée';
  end if;
  select household_id into v_household_id from containers where id = v_inv.container_id;
  insert into household_members (household_id, user_id) values (v_household_id, v_uid) on conflict do nothing;
  insert into container_members (container_id, user_id, role) values (v_inv.container_id, v_uid, v_inv.role)
    on conflict (container_id, user_id) do update set role = excluded.role;
  update container_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.container_id;
end;
$$;

create function public.apply_room_template(p_template_id uuid, p_room_id uuid) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_container_id uuid;
  v_uid uuid := auth.uid();
  item record;
  v_count integer := 0;
begin
  select container_id into v_container_id from rooms where id = p_room_id;
  if v_container_id is null then
    raise exception 'Pièce introuvable';
  end if;
  if not (container_role(v_container_id) in ('admin', 'member')) then
    raise exception 'Droits insuffisants';
  end if;
  if not room_template_visible(p_template_id) then
    raise exception 'Template introuvable';
  end if;
  for item in select * from room_template_items where template_id = p_template_id order by sort_order loop
    insert into tasks (
      container_id, room_id, title, description, priority,
      recurrence_type, recurrence_interval, recurrence_weekdays,
      freshness_days, source_template_item_id, created_by
    ) values (
      v_container_id, p_room_id, item.title, item.description, item.priority,
      item.recurrence_type, item.recurrence_interval, item.recurrence_weekdays,
      item.freshness_days, item.id, v_uid
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.apply_event_template(
  p_template_id uuid,
  p_container_id uuid,
  p_name text,
  p_event_date date
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  item record;
begin
  if not (container_role(p_container_id) in ('admin', 'member')) then
    raise exception 'Droits insuffisants';
  end if;
  if not event_template_visible(p_template_id) then
    raise exception 'Template introuvable';
  end if;
  insert into events (container_id, name, event_date, template_id, created_by)
    values (p_container_id, p_name, p_event_date, p_template_id, v_uid)
    returning id into v_event_id;
  for item in select * from event_template_items where event_template_id = p_template_id order by sort_order loop
    insert into tasks (container_id, title, description, priority, recurrence_type, due_date, source_event_id, created_by)
      values (p_container_id, item.title, item.description, item.priority, item.recurrence_type, p_event_date + item.offset_days, v_event_id, v_uid);
  end loop;
  return v_event_id;
end;
$$;

-- =========================================================================
-- 6. STOCKAGE (photos jointes aux tâches / preuves de complétion)
-- =========================================================================
-- Convention de chemin : {container_id}/{task_id}/{fichier} — la RLS vérifie
-- l'appartenance au conteneur à partir du premier segment du chemin.

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

create policy task_photos_select on storage.objects for select
  using (bucket_id = 'task-photos' and is_container_member((storage.foldername(name))[1]::uuid));

create policy task_photos_insert on storage.objects for insert
  with check (bucket_id = 'task-photos' and is_container_member((storage.foldername(name))[1]::uuid));

create policy task_photos_delete on storage.objects for delete
  using (bucket_id = 'task-photos' and is_container_member((storage.foldername(name))[1]::uuid));

-- =========================================================================
-- 7. GRANTS (RLS restreint ensuite les lignes visibles/modifiables)
-- =========================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
