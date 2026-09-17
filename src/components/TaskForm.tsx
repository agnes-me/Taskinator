'use client';

import { useState } from 'react';
import { saveTask } from '@/app/(app)/tasks/actions';
import { WEEKDAY_LABELS } from '@/lib/recurrence';

type Option = { id: string; name?: string; displayName?: string; icon?: string };

export function TaskForm({
  categories,
  zones,
  profiles,
  onDone,
}: {
  categories: Option[];
  zones: Option[];
  profiles: Option[];
  onDone?: () => void;
}) {
  const [recurrenceType, setRecurrenceType] = useState('NONE');

  return (
    <form
      action={async (formData) => {
        await saveTask(formData);
        onDone?.();
      }}
      className="card space-y-3"
    >
      <div>
        <label className="label">Titre</label>
        <input className="input" name="title" required placeholder="Ex: Passer l'aspirateur" />
      </div>
      <div>
        <label className="label">Description (optionnel)</label>
        <textarea className="input" name="description" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Catégorie</label>
          <select className="input" name="categoryId" defaultValue="">
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
          <select className="input" name="zoneId" defaultValue="">
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
          <select className="input" name="assigneeId" defaultValue="">
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
          <select className="input" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Échéance (optionnel)</label>
        <input className="input" type="date" name="dueDate" />
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
            <input className="input w-24" type="number" min={1} name="recurrenceInterval" defaultValue={1} />
          </div>
        )}

        {recurrenceType === 'WEEKLY' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="weekday" value={value} /> {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <button className="btn-primary w-full" type="submit">
        Enregistrer la tâche
      </button>
    </form>
  );
}
