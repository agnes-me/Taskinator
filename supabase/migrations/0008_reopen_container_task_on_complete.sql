-- Une tâche "conteneur" ponctuelle (ex. "Ménage complet") dont chaque sous-tâche a son propre
-- cycle de récurrence ne doit pas être classée "faite" définitivement quand on la coche : elle
-- sert de raccourci pour "j'ai fait toute la routine", et doit rester disponible pour la prochaine
-- fois. Sa fraîcheur reste pilotée par l'agrégat de ses sous-tâches (côté application), donc son
-- propre last_completed_at n'a d'usage que pour cette bascule immédiate de statut.
create or replace function public.after_task_completion() returns trigger language plpgsql as $$
declare
  v_task tasks%rowtype;
  v_next date;
  v_has_subtasks boolean;
begin
  select * into v_task from tasks where id = NEW.task_id;
  update task_completions
    set was_late = (v_task.due_date is not null and NEW.completed_at::date > v_task.due_date)
    where id = NEW.id;

  if v_task.recurrence_type is null or v_task.recurrence_type = 'none' then
    select exists(select 1 from tasks where parent_task_id = v_task.id) into v_has_subtasks;
    if v_has_subtasks then
      update tasks set status = 'todo', last_completed_at = NEW.completed_at where id = NEW.task_id;
    else
      update tasks set status = 'done', last_completed_at = NEW.completed_at where id = NEW.task_id;
    end if;
  else
    v_next := compute_next_due_date(v_task.recurrence_type, v_task.recurrence_interval, v_task.recurrence_weekdays, coalesce(NEW.completed_at::date, current_date));
    update tasks set status = 'todo', last_completed_at = NEW.completed_at, due_date = v_next where id = NEW.task_id;
  end if;
  return NEW;
end;
$$;
