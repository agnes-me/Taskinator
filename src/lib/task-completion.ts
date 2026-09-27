import type { SupabaseServerClient } from '@/lib/supabase/server';
import { syncTaskDone } from '@/lib/google-task-sync';

/**
 * Une tâche peut avoir des sous-tâches ponctuelles et/ou une liste de courses/cadeaux : elle ne se
 * complète automatiquement que si TOUT son contenu actuel est fait (les deux à la fois, quand les
 * deux existent) — sinon cocher la liste sans finir les sous-tâches (ou l'inverse) la compléterait
 * à tort. Appelé après avoir coché une sous-tâche ou un article de liste.
 */
export async function maybeAutoCompleteFromChildren(
  supabase: SupabaseServerClient,
  containerId: string,
  taskId: string,
  completedBy: string,
) {
  const { data: task } = await supabase.from('tasks').select('recurrence_type, status').eq('id', taskId).maybeSingle();
  if (!task) return;
  if (task.recurrence_type === 'none' && task.status === 'done') return; // déjà complétée

  const [{ data: subtasks }, { data: checklist }] = await Promise.all([
    supabase.from('tasks').select('status').eq('parent_task_id', taskId).eq('recurrence_type', 'none'),
    supabase.from('checklist_items').select('checked').eq('task_id', taskId),
  ]);

  const hasSubtasks = (subtasks?.length ?? 0) > 0;
  const hasChecklist = (checklist?.length ?? 0) > 0;
  if (!hasSubtasks && !hasChecklist) return;

  const subtasksDone = !hasSubtasks || subtasks!.every((s) => s.status === 'done');
  const checklistDone = !hasChecklist || checklist!.every((c) => c.checked);
  if (!subtasksDone || !checklistDone) return;

  await supabase.from('task_completions').insert({ task_id: taskId, completed_by: completedBy });
  await syncTaskDone(supabase, containerId, taskId);
}

/** Symétrique : décocher une sous-tâche ou un article de liste d'une tâche ponctuelle déjà marquée faite la rouvre aussi. */
export async function maybeAutoReopenFromChild(supabase: SupabaseServerClient, taskId: string) {
  const { data: task } = await supabase.from('tasks').select('recurrence_type, status').eq('id', taskId).maybeSingle();
  if (!task || task.recurrence_type !== 'none' || task.status !== 'done') return;
  await supabase.from('tasks').update({ status: 'todo' }).eq('id', taskId);
}
