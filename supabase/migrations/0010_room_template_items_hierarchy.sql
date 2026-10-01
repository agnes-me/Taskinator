-- Permet à un template de pièce d'encoder une tâche + ses sous-tâches (au lieu d'une liste plate
-- de tâches indépendantes), pour pouvoir transformer une tâche existante (ex. "Rentrée scolaire"
-- et ses 8 sous-tâches) en template réutilisable qui recrée la même hiérarchie.
alter table room_template_items add column parent_item_id uuid references room_template_items(id) on delete cascade;
create index on room_template_items (parent_item_id);

create or replace function public.apply_room_template(p_template_id uuid, p_room_id uuid) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_container_id uuid;
  v_uid uuid := auth.uid();
  item record;
  v_count integer := 0;
  v_new_id uuid;
  v_id_map jsonb := '{}'::jsonb;
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

  -- Passe 1 : items racines (sans parent) du template.
  for item in select * from room_template_items where template_id = p_template_id and parent_item_id is null order by sort_order loop
    insert into tasks (
      container_id, room_id, title, description, priority,
      recurrence_type, recurrence_interval, recurrence_weekdays,
      freshness_days, source_template_item_id, created_by
    ) values (
      v_container_id, p_room_id, item.title, item.description, item.priority,
      item.recurrence_type, item.recurrence_interval, item.recurrence_weekdays,
      item.freshness_days, item.id, v_uid
    ) returning id into v_new_id;
    v_id_map := v_id_map || jsonb_build_object(item.id::text, v_new_id::text);
    v_count := v_count + 1;
  end loop;

  -- Passe 2 : items enfants -> sous-tâches de la tâche racine créée juste au-dessus (sans room_id,
  -- comme toute sous-tâche, qui hérite de sa tâche parente).
  for item in select * from room_template_items where template_id = p_template_id and parent_item_id is not null order by sort_order loop
    if v_id_map ? item.parent_item_id::text then
      insert into tasks (
        container_id, room_id, parent_task_id, title, description, priority,
        recurrence_type, recurrence_interval, recurrence_weekdays,
        freshness_days, source_template_item_id, created_by
      ) values (
        v_container_id, null, (v_id_map ->> item.parent_item_id::text)::uuid, item.title, item.description, item.priority,
        item.recurrence_type, item.recurrence_interval, item.recurrence_weekdays,
        item.freshness_days, item.id, v_uid
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;
