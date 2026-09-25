-- Les sous-tâches ponctuelles d'une tâche récurrente servent de checklist pour son cycle (ex.
-- "Ménage du mercredi" avec 7 sous-tâches) : elles doivent redevenir "à faire" au nouveau cycle,
-- exactement comme les cases de la liste de courses associée (voir migration 0012).
create or replace function public.after_task_completion() returns trigger language plpgsql as $$
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
    update checklist_items set checked = false where task_id = NEW.task_id;
    update tasks set status = 'todo' where parent_task_id = NEW.task_id and recurrence_type = 'none';
  end if;
  return NEW;
end;
$$;
