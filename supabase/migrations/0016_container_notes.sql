-- Notes partagées par conteneur : un seul bloc-notes libre par conteneur, visible par tous ses
-- membres mais modifiable seulement par les admins/membres (les invité·es sont en lecture seule).
create table container_notes (
  container_id uuid primary key references containers(id) on delete cascade,
  content text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table container_notes enable row level security;

create policy container_notes_select on container_notes for select using (is_container_member(container_id));
create policy container_notes_insert on container_notes for insert with check (container_role(container_id) in ('admin', 'member'));
create policy container_notes_update on container_notes for update using (container_role(container_id) in ('admin', 'member')) with check (container_role(container_id) in ('admin', 'member'));
