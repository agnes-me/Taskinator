'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { EventSummary } from '@/lib/data/events';
import type { Priority, RecurrenceType } from '@/types/database';
import { formatDate, todayISO } from '@/lib/utils';
import { createEventTemplate, deleteEventTemplate, publishEventTemplate, applyEventTemplate, type EventTemplateItemInput } from './actions';

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

function NewEventTemplateForm({ containerId, onDone }: { containerId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎉');
  const [visibility, setVisibility] = useState<'personal' | 'container'>('personal');
  const [items, setItems] = useState<EventTemplateItemInput[]>([
    { title: '', offset_days: -7, priority: 'medium', recurrence_type: 'none' },
  ]);
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
        <label className="text-sm">
          Visibilité
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'personal' | 'container')} className="input mt-1">
            <option value="personal">Personnel</option>
            <option value="container">Partagé dans ce conteneur</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Étapes (décalage en jours par rapport au jour J)</span>
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => updateItem(i, { title: e.target.value })}
              placeholder="Réserver le camion"
              className="input flex-1 !py-1 text-sm"
            />
            <label className="flex items-center gap-1 text-xs">
              J
              <input
                type="number"
                value={item.offset_days}
                onChange={(e) => updateItem(i, { offset_days: Number(e.target.value) })}
                className="input !py-1 w-20 text-sm"
              />
            </label>
            <select
              value={item.priority}
              onChange={(e) => updateItem(i, { priority: e.target.value as Priority })}
              className="input !py-1 text-sm"
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
            startTransition(async () => {
              const res = await createEventTemplate(containerId, { name, icon, visibility, items: items.filter((i) => i.title.trim()) });
              if (res?.error) setError(res.error);
              else onDone();
            });
          }}
        >
          Créer le template
        </button>
        <button className="btn btn-ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function EventsClient({
  containerId,
  templates,
  events,
  canManage,
  currentUserId,
}: {
  containerId: string;
  templates: TemplateSummary[];
  events: EventSummary[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {canManage && <ApplyTemplateForm containerId={containerId} templates={templates} />}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Événements</h3>
        {events.length === 0 ? (
          <p className="card p-4 text-sm text-[var(--text-muted)]">Aucun événement pour l'instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="card flex items-center justify-between p-3 text-sm">
                <span>
                  {e.name} — {formatDate(e.event_date)}
                </span>
                <span className="text-[var(--text-muted)]">
                  {e.doneCount}/{e.taskCount} tâches faites
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Templates d'événement (rétroplanning)</h3>
          {!showForm ? (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Nouveau template
            </button>
          ) : (
            <NewEventTemplateForm containerId={containerId} onDone={() => setShowForm(false)} />
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="card flex flex-col gap-2 p-4">
                <span className="font-semibold">
                  {t.icon} {t.name}
                </span>
                <p className="text-xs text-[var(--text-muted)]">{t.itemCount} étape(s)</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {t.created_by === currentUserId && t.visibility !== 'public' && (
                    <button className="text-[var(--text-muted)] hover:underline" onClick={() => startTransition(() => void publishEventTemplate(containerId, t.id))}>
                      Publier sur la marketplace
                    </button>
                  )}
                  {t.created_by === currentUserId && (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
