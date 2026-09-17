'use client';

import { useState } from 'react';
import { saveTask } from '@/app/(app)/tasks/actions';
import { WEEKDAY_LABELS, WEEKDAY_FULL_LABELS } from '@/lib/recurrence';

type Option = { id: string; name?: string; displayName?: string; icon?: string };

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  zoneId: string | null;
  assigneeId: string | null;
  priority: string;
  dueDate: Date | null;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceWeekdays: string | null;
};

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

export function TaskForm({
  categories,
  zones,
  profiles,
  onDone,
  initialTask,
  householdId,
}: {
  categories: Option[];
  zones: Option[];
  profiles: Option[];
  onDone?: () => void;
  initialTask?: EditableTask;
  /** Conteneur cible pour une NOUVELLE tâche (vue multi-conteneurs). Ignoré en édition. */
  householdId?: string;
}) {
  const [recurrenceType, setRecurrenceType] = useState(initialTask?.recurrenceType ?? 'NONE');
  const selectedWeekdays = new Set((initialTask?.recurrenceWeekdays ?? '').split(',').filter(Boolean));

  return (
    <form
      action={async (formData) => {
        await saveTask(formData);
        onDone?.();
      }}
      className="card space-y-3"
    >
      {initialTask && <input type="hidden" name="id" value={initialTask.id} />}
      {!initialTask && householdId && <input type="hidden" name="householdId" value={householdId} />}
      <div>
        <label className="label">Titre</label>
        <input
          className="input"
          name="title"
          required
          placeholder="Ex: Passer l'aspirateur"
          defaultValue={initialTask?.title}
        />
      </div>
      <div>
        <label className="label">Description (optionnel)</label>
        <textarea className="input" name="description" rows={2} defaultValue={initialTask?.description ?? ''} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Catégorie</label>
          <select className="input" name="categoryId" defaultValue={initialTask?.categoryId ?? ''}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Zone</label>
          <select className="input" name="zoneId" defaultValue={initialTask?.zoneId ?? ''}>
            <option value="">—</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.icon} {z.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Assigné à</label>
          <select className="input" name="assigneeId" defaultValue={initialTask?.assigneeId ?? ''}>
            <option value="">—</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priorité</label>
          <select className="input" name="priority" defaultValue={initialTask?.priority ?? 'MEDIUM'}>
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Échéance (optionnel)</label>
        <input className="input" type="date" name="dueDate" defaultValue={toDateInputValue(initialTask?.dueDate ?? null)} />
      </div>

      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <label className="label">Périodicité</label>
        <select
          className="input"
          name="recurrenceType"
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value)}
        >
          <option value="NONE">Ponctuelle (pas de répétition)</option>
          <option value="DAILY">Tous les X jours</option>
          <option value="WEEKLY">Toutes les semaines</option>
          <option value="MONTHLY">Tous les X mois</option>
          <option value="CUSTOM_DAYS">Intervalle personnalisé (jours)</option>
        </select>

        {(recurrenceType === 'DAILY' || recurrenceType === 'MONTHLY' || recurrenceType === 'CUSTOM_DAYS') && (
          <div className="mt-2">
            <label className="label">Toutes les combien de {recurrenceType === 'MONTHLY' ? 'mois' : 'jours'} ?</label>
            <input
              className="input w-24"
              type="number"
              min={1}
              name="recurrenceInterval"
              defaultValue={initialTask?.recurrenceInterval ?? 1}
            />
          </div>
        )}

        {recurrenceType === 'WEEKLY' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="weekday" value={value} defaultChecked={selectedWeekdays.has(value)} /> {label}
              </label>
            ))}
          </div>
        )}

        {recurrenceType === 'MONTHLY' && (
          <div className="mt-2">
            <label className="label">Toujours un jour précis ? (optionnel)</label>
            <select className="input" name="weekday" defaultValue={[...selectedWeekdays][0] ?? ''}>
              <option value="">Même quantième chaque fois</option>
              {Object.entries(WEEKDAY_FULL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  Le {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Ex: &quot;tous les 2 mois, le samedi&quot; → la tâche revient toujours un samedi.
            </p>
          </div>
        )}
      </div>

      <button className="btn-primary w-full" type="submit">
        {initialTask ? 'Mettre à jour la tâche' : 'Enregistrer la tâche'}
      </button>
    </form>
  );
}
