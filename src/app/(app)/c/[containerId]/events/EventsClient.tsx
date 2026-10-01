'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { EventSummary } from '@/lib/data/events';
import type { ChecklistTemplate } from '@/lib/data/checklist';
import type { EventRecurrenceType } from '@/types/database';
import { formatDate, todayISO } from '@/lib/utils';
import { TaskRow } from '@/components/TaskRow';
import { TaskForm, type ContainerMember } from '@/components/TaskForm';
import { applyEventTemplate, createEvent, updateEvent, deleteEvent } from './actions';

const RECURRENCE_LABELS: Record<EventRecurrenceType, string> = {
  none: 'Une fois',
  weekly: 'Toutes les semaines',
  monthly: 'Tous les mois',
  yearly: 'Tous les ans (ex. anniversaire)',
};

function RecurrenceSelect({ value, onChange }: { value: EventRecurrenceType; onChange: (v: EventRecurrenceType) => void }) {
  return (
    <label className="text-sm">
      Périodicité
      <select value={value} onChange={(e) => onChange(e.target.value as EventRecurrenceType)} className="input mt-1">
        {(Object.keys(RECURRENCE_LABELS) as EventRecurrenceType[]).map((r) => (
          <option key={r} value={r}>
            {RECURRENCE_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewEventForm({ containerId, templates }: { containerId: string; templates: TemplateSummary[] }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [recurrence, setRecurrence] = useState<EventRecurrenceType>('none');
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
      <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
      <button
        disabled={pending || !name.trim()}
        className="btn btn-primary"
        onClick={() =>
          startTransition(async () => {
            const res = templateId
              ? await applyEventTemplate(containerId, templateId, name, date, recurrence)
              : await createEvent(containerId, name, date, recurrence);
            if (res?.error) setError(res.error);
            else {
              setName('');
              setTemplateId('');
              setRecurrence('none');
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

function EditEventForm({ event, containerId, onDone, onCancel }: { event: EventSummary; containerId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.event_date);
  const [recurrence, setRecurrence] = useState<EventRecurrenceType>(event.recurrence_type);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card flex flex-wrap items-end gap-2 p-3">
      <label className="text-sm">
        Nom de l'événement
        <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" autoFocus />
      </label>
      <label className="text-sm">
        Date de l'événement
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
      </label>
      <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
      <button
        disabled={pending || !name.trim()}
        className="btn btn-primary"
        onClick={() =>
          startTransition(async () => {
            const res = await updateEvent(containerId, event.id, { name, event_date: date, recurrence_type: recurrence });
            if (res?.error) setError(res.error);
            else onDone();
          })
        }
      >
        Enregistrer
      </button>
      <button className="btn btn-ghost" onClick={onCancel}>
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
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [, startTransition] = useTransition();
  const isRecurring = event.recurrence_type !== 'none';

  if (editing) {
    return <EditEventForm event={event} containerId={containerId} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setExpanded((e) => !e)}>
          <span>
            {expanded ? '▾' : '▸'} {event.name} — {formatDate(event.nextOccurrence)}
            {isRecurring && (
              <span className="ml-1 text-xs text-[var(--text-muted)]">🔁 {RECURRENCE_LABELS[event.recurrence_type].toLowerCase()}</span>
            )}
          </span>
        </button>
        <span className="shrink-0 text-[var(--text-muted)]">
          {event.doneCount}/{event.taskCount} tâches faites
        </span>
        {canEdit && !confirmingDelete && (
          <span className="flex shrink-0 items-center gap-1">
            <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(true)}>
              ✏️
            </button>
            <button className="btn btn-ghost !px-2 !py-1 text-xs text-fresh-low" onClick={() => setConfirmingDelete(true)}>
              🗑
            </button>
          </span>
        )}
        {canEdit && confirmingDelete && (
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <button
              className="btn btn-primary !px-2 !py-1 !bg-fresh-low text-xs"
              onClick={() => startTransition(() => deleteEvent(containerId, event.id))}
            >
              Supprimer
            </button>
            <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setConfirmingDelete(false)}>
              Annuler
            </button>
          </span>
        )}
      </div>

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
