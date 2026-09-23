'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { EventSummary } from '@/lib/data/events';
import type { ChecklistTemplate } from '@/lib/data/checklist';
import { formatDate, todayISO } from '@/lib/utils';
import { TaskRow } from '@/components/TaskRow';
import { TaskForm, type ContainerMember } from '@/components/TaskForm';
import { applyEventTemplate, createEvent } from './actions';

function NewEventForm({ containerId, templates }: { containerId: string; templates: TemplateSummary[] }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="self-start text-sm text-[var(--text-muted)] hover:underline" onClick={() => setOpen(true)}>
        + Nouvel événement
      </button>
    );
  }

  return (
    <div className="card flex flex-wrap items-end gap-2 p-4">
      {templates.length > 0 && (
        <label className="text-sm">
          Template (optionnel)
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input mt-1">
            <option value="">Aucun — événement vide</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm">
        Nom de l'événement
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anniversaire de Léa" className="input mt-1" autoFocus />
      </label>
      <label className="text-sm">
        Date de l'événement
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
      </label>
      <button
        disabled={pending || !name.trim()}
        className="btn btn-primary"
        onClick={() =>
          startTransition(async () => {
            const res = templateId ? await applyEventTemplate(containerId, templateId, name, date) : await createEvent(containerId, name, date);
            if (res?.error) setError(res.error);
            else {
              setName('');
              setTemplateId('');
              setError(null);
              setOpen(false);
            }
          })
        }
      >
        {templateId ? 'Générer le rétroplanning' : 'Créer'}
      </button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>
        Annuler
      </button>
      {error && <p className="w-full text-sm text-fresh-low">{error}</p>}
    </div>
  );
}

function EventCard({
  event,
  containerId,
  members,
  rooms,
  currentUserId,
  isGuest,
  canEdit,
  checklistTemplates,
}: {
  event: EventSummary;
  containerId: string;
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  currentUserId: string;
  isGuest: boolean;
  canEdit: boolean;
  checklistTemplates: ChecklistTemplate[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  return (
    <div className="card p-3 text-sm">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setExpanded((e) => !e)}>
        <span>
          {expanded ? '▾' : '▸'} {event.name} — {formatDate(event.event_date)}
        </span>
        <span className="shrink-0 text-[var(--text-muted)]">
          {event.doneCount}/{event.taskCount} tâches faites
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          {event.tasks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Aucune tâche de rétroplanning pour cet événement.</p>
          ) : (
            event.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                containerId={containerId}
                members={members}
                rooms={rooms}
                currentUserId={currentUserId}
                isGuest={isGuest}
                canEdit={canEdit}
                checklistTemplates={checklistTemplates}
              />
            ))
          )}

          {canEdit && !addingTask && (
            <button className="self-start text-xs text-[var(--text-muted)] hover:underline" onClick={() => setAddingTask(true)}>
              + Ajouter une tâche
            </button>
          )}
          {canEdit && addingTask && (
            <div className="card p-3">
              <TaskForm
                containerId={containerId}
                members={members}
                rooms={rooms}
                fixedEventId={event.id}
                onDone={() => setAddingTask(false)}
                onCancel={() => setAddingTask(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EventsClient({
  containerId,
  templates,
  events,
  members,
  rooms,
  canManage,
  isGuest,
  currentUserId,
  checklistTemplates,
}: {
  containerId: string;
  templates: TemplateSummary[];
  events: EventSummary[];
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  canManage: boolean;
  isGuest: boolean;
  currentUserId: string;
  checklistTemplates: ChecklistTemplate[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {canManage && <NewEventForm containerId={containerId} templates={templates} />}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Événements</h3>
        {events.length === 0 ? (
          <p className="card p-4 text-sm text-[var(--text-muted)]">Aucun événement pour l'instant.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                containerId={containerId}
                members={members}
                rooms={rooms}
                currentUserId={currentUserId}
                isGuest={isGuest}
                canEdit={canManage}
                checklistTemplates={checklistTemplates}
              />
            ))}
          </div>
        )}
      </div>

      {canManage && templates.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Aucun template d'événement pour l'instant — crées-en un depuis « ⚙️ Paramètres ».
        </p>
      )}
    </div>
  );
}
