import { completeTask, deleteTask, pauseTask, resumeTask } from '@/app/(app)/tasks/actions';
import { RECURRENCE_LABELS } from '@/lib/recurrence';
import { buildGoogleCalendarLink } from '@/lib/ics';
import type { Priority, RecurrenceType } from '@/lib/types';
import { TaskForm } from './TaskForm';

type Option = { id: string; name?: string; displayName?: string; icon?: string };

export type TaskRowData = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  zoneId: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  priority: string;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceWeekdays: string | null;
  pausedUntil: Date | null;
  pauseReason: string | null;
  category: { name: string; icon: string; color: string } | null;
  zone: { name: string; icon: string } | null;
  assignee: { displayName: string; color: string } | null;
};

const PRIORITY_LABELS: Record<Priority, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute' };
const PRIORITY_DOT: Record<Priority, string> = { LOW: 'bg-slate-300', MEDIUM: 'bg-amber-400', HIGH: 'bg-red-500' };

/** Ligne de tâche épurée pour le tableau de bord : repliée par défaut, dépliable pour voir
 * le détail et la modifier sur place, sans changer de page. */
export function TaskRow({
  task,
  categories,
  zones,
  profiles,
  isHouseholdPaused,
}: {
  task: TaskRowData;
  categories: Option[];
  zones: Option[];
  profiles: Option[];
  isHouseholdPaused: boolean;
}) {
  const priority = task.priority as Priority;
  const isTaskPaused = task.pausedUntil && task.pausedUntil > new Date();
  const overdue = task.dueDate && task.dueDate < new Date() && !isTaskPaused && !isHouseholdPaused;

  return (
    <div className="card flex items-start gap-2 !py-2.5">
      <form action={completeTask.bind(null, task.id)} className="pt-0.5">
        <button
          type="submit"
          aria-label="Marquer comme fait"
          className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 transition hover:border-brand-500 hover:bg-brand-50 dark:border-slate-600 dark:hover:bg-brand-900/30"
        />
      </form>

      <details className="min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priority]}`} title={PRIORITY_LABELS[priority]} />
            <span className="truncate text-sm font-medium">{task.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
            {(isTaskPaused || isHouseholdPaused) && <span title="Rappels en pause">⏸️</span>}
            {task.dueDate && (
              <span className={overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                {task.dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <span className="text-slate-300 dark:text-slate-600">▾</span>
          </span>
        </summary>

        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          {task.description && <p className="text-sm text-slate-500">{task.description}</p>}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {task.category && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${task.category.color}22`, color: task.category.color }}
              >
                {task.category.icon} {task.category.name}
              </span>
            )}
            {task.zone && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {task.zone.icon} {task.zone.name}
              </span>
            )}
            {task.assignee && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                👤 {task.assignee.displayName}
              </span>
            )}
            {task.recurrenceType !== 'NONE' && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                🔁 {RECURRENCE_LABELS[task.recurrenceType as RecurrenceType]}
              </span>
            )}
          </div>

          {(isTaskPaused || isHouseholdPaused) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⏸️ Rappels en pause
              {task.pausedUntil ? ` jusqu'au ${task.pausedUntil.toLocaleDateString('fr-FR')}` : ''}
              {task.pauseReason ? ` — ${task.pauseReason}` : ''}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {task.dueDate && (
              <a
                className="btn-secondary text-xs"
                href={buildGoogleCalendarLink({ title: task.title, description: task.description, dueDate: task.dueDate })}
                target="_blank"
                rel="noreferrer"
              >
                + Google Cal.
              </a>
            )}

            {isTaskPaused ? (
              <form action={resumeTask.bind(null, task.id)}>
                <button className="btn-secondary text-xs">Reprendre</button>
              </form>
            ) : (
              <details className="relative">
                <summary className="btn-secondary inline-block cursor-pointer text-xs">Pause</summary>
                <form
                  action={pauseTask}
                  className="absolute z-10 mt-2 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <div>
                    <label className="label">Jusqu&apos;au</label>
                    <input className="input" type="date" name="until" required />
                  </div>
                  <div>
                    <label className="label">Raison</label>
                    <input className="input" name="reason" placeholder="Vacances..." />
                  </div>
                  <button className="btn-primary w-full text-sm">Mettre en pause</button>
                </form>
              </details>
            )}

            <details className="w-full">
              <summary className="btn-secondary inline-block cursor-pointer text-xs">✏️ Modifier</summary>
              <div className="mt-2">
                <TaskForm categories={categories} zones={zones} profiles={profiles} initialTask={task} />
              </div>
            </details>

            <form action={deleteTask.bind(null, task.id)}>
              <button className="text-xs text-red-600 hover:underline">Supprimer</button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}
