import { completeTask, deleteTask, pauseTask, resumeTask } from '@/app/(app)/tasks/actions';
import { buildRecurrenceLabel } from '@/lib/recurrence';
import { buildGoogleCalendarLink } from '@/lib/ics';
import type { Priority, RecurrenceType } from '@/lib/types';

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const PRIORITY_LABELS: Record<Priority, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute' };

export type TaskCardData = {
  id: string;
  title: string;
  description: string | null;
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

export function TaskCard({ task, isHouseholdPaused }: { task: TaskCardData; isHouseholdPaused: boolean }) {
  const isTaskPaused = task.pausedUntil && task.pausedUntil > new Date();
  const overdue = task.dueDate && task.dueDate < new Date() && !isTaskPaused && !isHouseholdPaused;
  const priority = task.priority as Priority;
  const recurrenceType = task.recurrenceType as RecurrenceType;

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{task.title}</p>
          {task.description && <p className="text-sm text-slate-500">{task.description}</p>}
        </div>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
          {PRIORITY_LABELS[priority]}
        </span>
      </div>

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
        {recurrenceType !== 'NONE' && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            🔁 {buildRecurrenceLabel(recurrenceType, task.recurrenceInterval, task.recurrenceWeekdays)}
          </span>
        )}
        {task.dueDate && (
          <span className={`rounded-full px-2 py-0.5 ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            📆 {task.dueDate.toLocaleDateString('fr-FR')}
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
        <form action={completeTask.bind(null, task.id)}>
          <button className="btn-primary text-sm">✓ Fait</button>
        </form>

        {task.dueDate && (
          <a
            className="btn-secondary text-sm"
            href={buildGoogleCalendarLink({ title: task.title, description: task.description, dueDate: task.dueDate })}
            target="_blank"
            rel="noreferrer"
          >
            + Google Cal.
          </a>
        )}

        {isTaskPaused ? (
          <form action={resumeTask.bind(null, task.id)}>
            <button className="btn-secondary text-sm">Reprendre</button>
          </form>
        ) : (
          <details className="relative">
            <summary className="btn-secondary inline-block cursor-pointer text-sm">Pause</summary>
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

        <form action={deleteTask.bind(null, task.id)}>
          <button className="text-sm text-red-600 hover:underline">Supprimer</button>
        </form>
      </div>
    </div>
  );
}
