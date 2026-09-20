'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { EventSummary } from '@/lib/data/events';
import type { Priority, RecurrenceType } from '@/types/database';
import { formatDate, todayISO } from '@/lib/utils';
import { TaskRow } from '@/components/TaskRow';
import type { ContainerMember } from '@/components/TaskForm';
import {
  createEventTemplate,
  deleteEventTemplate,
  publishEventTemplate,
  applyEventTemplate,
  getEventTemplateItems,
  updateEventTemplate,
  type EventTemplateItemInput,
} from './actions';

function ApplyTemplateForm({ containerId, templates }: { containerId: string; templates: TemplateSummary[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (templates.length === 0) return null;

  return (
    <div className="card flex flex-wrap items-end gap-2 p-4">
      <label className="text-sm">
        Template
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input mt-1">
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Nom de l'événement
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacances à la mer" className="input mt-1" />
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
            const res = await applyEventTemplate(containerId, templateId, name, date);
            if (res?.error) setError(res.error);
            else {
              setName('');
              setError(null);
            }
          })
        }
      >
        Générer le rétroplanning
      </button>
      {error && <p className="w-full text-sm text-fresh-low">{error}</p>}
    </div>
  );
}

function EventTemplateForm({
  containerId,
  onDone,
  onCancel,
  templateId,
  initialName,
  initialIcon,
  initialItems,
}: {
  containerId: string;
  onDone: () => void;
  onCancel?: () => void;
  templateId?: string;
  initialName?: string;
  initialIcon?: string;
  initialItems?: EventTemplateItemInput[];
}) {
  const isEdit = Boolean(templateId);
  const [name, setName] = useState(initialName ?? '');
  const [icon, setIcon] = useState(initialIcon ?? '🎉');
  const [visibility, setVisibility] = useState<'personal' | 'container'>('personal');
  const [items, setItems] = useState<EventTemplateItemInput[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [{ title: '', offset_days: -7, priority: 'medium', recurrence_type: 'none' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateItem(i: number, patch: Partial<EventTemplateItemInput>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Nom du template
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Déménagement" className="input mt-1" />
        </label>
        <label className="text-sm">
          Icône
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className="input mt-1 w-16 text-center" />
        </label>
        {!isEdit && (
          <label className="text-sm">
            Visibilité
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'personal' | 'container')} className="input mt-1">
              <option value="personal">Personnel</option>
              <option value="container">Partagé dans ce conteneur</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Étapes (décalage en jours par rapport au jour J)</span>
        <div className="hidden flex-wrap gap-2 text-xs text-[var(--text-muted)] sm:flex">
          <span className="flex-1">Titre de l'étape</span>
          <span className="w-24">Jour (J-30, J+1…)</span>
          <span className="w-[110px]">Priorité</span>
          <span className="w-4" />
        </div>
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => updateItem(i, { title: e.target.value })}
              placeholder="Réserver le camion"
              className="input flex-1 !py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-xs" title="Décalage en jours par rapport à la date de l'événement (jour J)">
              J
              <input
                type="number"
                value={item.offset_days}
                onChange={(e) => updateItem(i, { offset_days: Number(e.target.value) })}
                className="input !py-1 w-16 text-sm"
              />
            </label>
            <select
              aria-label="Priorité"
              value={item.priority}
              onChange={(e) => updateItem(i, { priority: e.target.value as Priority })}
              className="input w-[110px] !py-1 text-sm"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
            <button className="text-xs text-fresh-low" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button
          className="self-start text-xs text-[var(--text-muted)] hover:underline"
          onClick={() => setItems((prev) => [...prev, { title: '', offset_days: 0, priority: 'medium', recurrence_type: 'none' as RecurrenceType }])}
        >
          + étape
        </button>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="btn btn-primary"
          onClick={() => {
            if (!name.trim()) {
              setError('Le nom est requis.');
              return;
            }
            const cleanItems = items.filter((i) => i.title.trim());
            startTransition(async () => {
              const res =
                isEdit && templateId
                  ? await updateEventTemplate(containerId, templateId, { name, icon, items: cleanItems })
                  : await createEventTemplate(containerId, { name, icon, visibility, items: cleanItems });
              if (res?.error) setError(res.error);
              else onDone();
            });
          }}
        >
          {isEdit ? 'Enregistrer' : 'Créer le template'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel ?? onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function EventTemplateCard({
  t,
  containerId,
  currentUserId,
}: {
  t: TemplateSummary;
  containerId: string;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EventTemplateItemInput[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isOwner = t.created_by === currentUserId;

  function openEdit() {
    startTransition(async () => {
      const res = await getEventTemplateItems(t.id);
      if ('error' in res) setLoadError(res.error);
      else {
        setEditItems(res.items);
        setEditing(true);
      }
    });
  }

  if (editing && editItems) {
    return (
      <EventTemplateForm
        containerId={containerId}
        templateId={t.id}
        initialName={t.name}
        initialIcon={t.icon}
        initialItems={editItems}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <span className="font-semibold">
        {t.icon} {t.name}
      </span>
      <p className="text-xs text-[var(--text-muted)]">{t.itemCount} étape(s)</p>
      {loadError && <p className="text-xs text-fresh-low">{loadError}</p>}
      <div className="flex flex-wrap gap-2 text-xs">
        {isOwner && (
          <button className="text-[var(--text-muted)] hover:underline" onClick={openEdit}>
            Voir / Modifier
          </button>
        )}
        {isOwner && t.visibility !== 'public' && (
          <button className="text-[var(--text-muted)] hover:underline" onClick={() => startTransition(() => void publishEventTemplate(containerId, t.id))}>
            Publier sur la marketplace
          </button>
        )}
        {isOwner && (
          <button
            disabled={pending}
            className="text-fresh-low hover:underline"
            onClick={() => {
              if (window.confirm('Supprimer ce template ?')) startTransition(() => deleteEventTemplate(containerId, t.id));
            }}
          >
            Supprimer
          </button>
        )}
      </div>
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
}: {
  event: EventSummary;
  containerId: string;
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  currentUserId: string;
  isGuest: boolean;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

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
              />
            ))
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
}: {
  containerId: string;
  templates: TemplateSummary[];
  events: EventSummary[];
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  canManage: boolean;
  isGuest: boolean;
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {canManage && <ApplyTemplateForm containerId={containerId} templates={templates} />}

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
              />
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div>
          <button
            className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:underline"
            onClick={() => setShowTemplates((s) => !s)}
          >
            {showTemplates ? '▾' : '▸'} Gérer les templates d'événement ({templates.length})
          </button>
          {showTemplates && (
            <div className="mt-3">
              {!showForm ? (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  + Nouveau template
                </button>
              ) : (
                <EventTemplateForm containerId={containerId} onDone={() => setShowForm(false)} />
              )}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <EventTemplateCard key={t.id} t={t} containerId={containerId} currentUserId={currentUserId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
