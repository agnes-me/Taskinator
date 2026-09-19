'use client';

import { useState, useTransition } from 'react';
import type { TaskRow as TaskRowType } from '@/lib/data/tasks';
import { createTask, updateTask } from '@/app/(app)/c/[containerId]/tasks/actions';

export type ContainerMember = { user_id: string; email: string; display_name: string | null };

const WEEKDAYS = [
  { v: 1, l: 'L' },
  { v: 2, l: 'M' },
  { v: 3, l: 'M' },
  { v: 4, l: 'J' },
  { v: 5, l: 'V' },
  { v: 6, l: 'S' },
  { v: 7, l: 'D' },
];
const MONTHS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function TaskForm({
  containerId,
  members,
  rooms,
  task,
  fixedRoomId,
  onDone,
  onCancel,
}: {
  containerId: string;
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  task?: TaskRowType;
  fixedRoomId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrence_type ?? 'none');
  const [onCalendar, setOnCalendar] = useState(task?.on_calendar ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedWeekdays = (task?.recurrence_weekdays ?? '').split(',').filter(Boolean);
  const selectedAssignees = task?.assignees.map((a) => a.user_id) ?? [];

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = task ? await updateTask(task.id, containerId, formData) : await createTask(containerId, formData);
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      {fixedRoomId && <input type="hidden" name="roomId" value={fixedRoomId} />}
      <label className="text-sm font-medium">
        Titre
        <input name="title" required defaultValue={task?.title ?? ''} className="input mt-1 w-full" />
      </label>
      <label className="text-sm font-medium">
        Description
        <textarea name="description" defaultValue={task?.description ?? ''} className="input mt-1 w-full" rows={2} />
      </label>

      <div className="flex flex-wrap gap-3">
        {!fixedRoomId && (
          <label className="text-sm">
            Pièce
            <select name="roomId" defaultValue={task?.room_id ?? ''} className="input mt-1">
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          Priorité
          <select name="priority" defaultValue={task?.priority ?? 'medium'} className="input mt-1">
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
          </select>
        </label>
        <label className="text-sm">
          Échéance
          <input name="dueDate" type="date" defaultValue={task?.due_date ?? ''} className="input mt-1" />
        </label>
      </div>

      <div>
        <span className="text-sm font-medium">Récurrence</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select name="recurrenceType" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as typeof recurrenceType)} className="input">
            <option value="none">Ponctuelle</option>
            <option value="daily">Quotidienne</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuelle</option>
            <option value="custom_days">Tous les X jours</option>
          </select>
          {recurrenceType !== 'none' && (
            <label className="text-sm">
              Tous les
              <input name="recurrenceInterval" type="number" min={1} defaultValue={task?.recurrence_interval ?? 1} className="input mx-1 w-16" />
            </label>
          )}
          {recurrenceType === 'weekly' && (
            <div className="flex gap-1">
              {WEEKDAYS.map((wd) => (
                <label key={wd.v} className="cursor-pointer">
                  <input type="checkbox" name="weekday" value={wd.v} defaultChecked={selectedWeekdays.includes(String(wd.v))} className="peer sr-only" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-xs peer-checked:border-brand-500 peer-checked:bg-brand-50">
                    {wd.l}
                  </span>
                </label>
              ))}
            </div>
          )}
          {recurrenceType !== 'none' && (
            <label className="text-sm">
              Fraîcheur (jours avant dégradation)
              <input name="freshnessDays" type="number" min={1} defaultValue={task?.freshness_days ?? ''} placeholder="défaut pièce" className="input ml-1 w-28" />
            </label>
          )}
        </div>
      </div>

      {recurrenceType !== 'none' && (
        <div>
          <span className="text-sm font-medium">Saisonnalité (optionnel)</span>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <select name="seasonalStart" defaultValue={task?.seasonal_start_month ?? ''} className="input">
              <option value="">Du —</option>
              {MONTHS.slice(1).map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select name="seasonalEnd" defaultValue={task?.seasonal_end_month ?? ''} className="input">
              <option value="">au —</option>
              {MONTHS.slice(1).map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="onCalendar" checked={onCalendar} onChange={(e) => setOnCalendar(e.target.checked)} />
          Afficher dans le calendrier (time-blocking)
        </label>
        {onCalendar && (
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="text-sm">
              Début
              <input name="startAt" type="datetime-local" defaultValue={task?.start_at?.slice(0, 16) ?? ''} className="input mt-1" />
            </label>
            <label className="text-sm">
              Durée (min)
              <input name="durationMinutes" type="number" min={5} step={5} defaultValue={task?.duration_minutes ?? 30} className="input mt-1 w-24" />
            </label>
          </div>
        )}
      </div>

      {members.length > 0 && (
        <div>
          <span className="text-sm font-medium">Assigné·e à</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {members.map((m) => (
              <label key={m.user_id} className="cursor-pointer">
                <input type="checkbox" name="assigneeId" value={m.user_id} defaultChecked={selectedAssignees.includes(m.user_id)} className="peer sr-only" />
                <span className="chip border border-[var(--border)] bg-[var(--surface)] peer-checked:border-brand-500 peer-checked:bg-brand-50">
                  {m.display_name || m.email}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {task ? 'Enregistrer' : 'Créer la tâche'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
