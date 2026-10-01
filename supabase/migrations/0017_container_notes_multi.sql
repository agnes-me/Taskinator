-- Passage d'une note unique par conteneur à plusieurs notes titrées, avec images attachées.
create table container_notes_new (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  title text not null default 'Sans titre',
  content text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into container_notes_new (container_id, title, content, updated_by, updated_at, created_by, created_at)
select container_id, 'Notes', content, updated_by, updated_at, updated_by, updated_at
from container_notes
where content is not null and content <> '';

drop table container_notes;
alter table container_notes_new rename to container_notes;
create index on container_notes (container_id);

alter table container_notes enable row level security;
create policy container_notes_select on container_notes for select using (is_container_member(container_id));
create policy container_notes_insert on container_notes for insert with check (container_role(container_id) in ('admin', 'member'));
create policy container_notes_update on container_notes for update using (container_role(container_id) in ('admin', 'member')) with check (container_role(container_id) in ('admin', 'member'));
create policy container_notes_delete on container_notes for delete using (container_role(container_id) in ('admin', 'member'));

create table container_note_images (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references container_notes(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index on container_note_images (note_id);

alter table container_note_images enable row level security;
create policy container_note_images_select on container_note_images for select using (
  exists (select 1 from container_notes n where n.id = note_id and is_container_member(n.container_id))
);
create policy container_note_images_insert on container_note_images for insert with check (
  exists (select 1 from container_notes n where n.id = note_id and container_role(n.container_id) in ('admin', 'member'))
);
create policy container_note_images_delete on container_note_images for delete using (
  exists (select 1 from container_notes n where n.id = note_id and container_role(n.container_id) in ('admin', 'member'))
);

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', false)
on conflict (id) do nothing;

create policy note_images_select on storage.objects for select
  using (bucket_id = 'note-images' and is_container_member((storage.foldername(name))[1]::uuid));
create policy note_images_insert on storage.objects for insert
  with check (bucket_id = 'note-images' and container_role((storage.foldername(name))[1]::uuid) in ('admin', 'member'));
create policy note_images_delete on storage.objects for delete
  using (bucket_id = 'note-images' and container_role((storage.foldername(name))[1]::uuid) in ('admin', 'member'));
