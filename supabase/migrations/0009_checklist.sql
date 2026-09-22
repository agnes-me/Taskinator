-- Listes à deux niveaux (groupe -> articles) rattachées à une tâche (courses, cadeaux...),
-- plus des templates réutilisables par conteneur. Volontairement une structure légère et
-- séparée des sous-tâches : un article de liste ne porte ni priorité, ni récurrence, ni
-- assignation, contrairement à une sous-tâche qui est une tâche à part entière.
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  group_name text,
  label text not null,
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index on checklist_items (task_id, sort_order);

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  name text not null,
  icon text not null default '🛒',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on checklist_templates (container_id);

create table checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id) on delete cascade,
  group_name text,
  label text not null,
  sort_order integer not null default 0
);
create index on checklist_template_items (template_id, sort_order);

alter table checklist_items enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_template_items enable row level security;

-- checklist_items : mêmes seuils que le reste d'une tâche (lecture = membre du conteneur,
-- écriture = admin/membre), via la tâche parente.
create policy checklist_items_select on checklist_items for select using (
  exists (select 1 from tasks t where t.id = task_id and is_container_member(t.container_id))
);
create policy checklist_items_insert on checklist_items for insert with check (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
);
create policy checklist_items_update on checklist_items for update using (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
) with check (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
);
create policy checklist_items_delete on checklist_items for delete using (
  exists (select 1 from tasks t where t.id = task_id and container_role(t.container_id) in ('admin', 'member'))
);

create policy checklist_templates_select on checklist_templates for select using (is_container_member(container_id));
create policy checklist_templates_insert on checklist_templates for insert with check (container_role(container_id) in ('admin', 'member'));
create policy checklist_templates_update on checklist_templates for update using (container_role(container_id) in ('admin', 'member'));
create policy checklist_templates_delete on checklist_templates for delete using (container_role(container_id) in ('admin', 'member'));

create policy checklist_template_items_select on checklist_template_items for select using (
  exists (select 1 from checklist_templates ct where ct.id = template_id and is_container_member(ct.container_id))
);
create policy checklist_template_items_insert on checklist_template_items for insert with check (
  exists (select 1 from checklist_templates ct where ct.id = template_id and container_role(ct.container_id) in ('admin', 'member'))
);
create policy checklist_template_items_update on checklist_template_items for update using (
  exists (select 1 from checklist_templates ct where ct.id = template_id and container_role(ct.container_id) in ('admin', 'member'))
);
create policy checklist_template_items_delete on checklist_template_items for delete using (
  exists (select 1 from checklist_templates ct where ct.id = template_id and container_role(ct.container_id) in ('admin', 'member'))
);
