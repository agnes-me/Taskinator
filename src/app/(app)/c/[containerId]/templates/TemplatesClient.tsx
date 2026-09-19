'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { Priority, RecurrenceType } from '@/types/database';
import {
  createRoomTemplate,
  deleteRoomTemplate,
  duplicateRoomTemplate,
  publishRoomTemplate,
  applyRoomTemplateToRoom,
  type TemplateItemInput,
} from './actions';

const MODERATION_LABEL: Record<string, string> = {
  draft: '',
  pending: '⏳ En attente de modération',
  approved: '✅ Publié',
  rejected: '❌ Refusé',
};

function TemplateCard({
  tpl,
  containerId,
  rooms,
  canManage,
  currentUserId,
}: {
  tpl: TemplateSummary;
  containerId: string;
  rooms: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = tpl.created_by === currentUserId;

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {tpl.icon} {tpl.name}
        </span>
        {tpl.moderation_status !== 'approved' && tpl.visibility === 'public' && (
          <span className="chip bg-[var(--surface-muted)] text-xs">{MODERATION_LABEL[tpl.moderation_status]}</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)]">{tpl.itemCount} tâche(s)</p>

      {rooms.length > 0 && canManage && (
        <div className="flex items-center gap-2">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input !py-1 text-sm">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !roomId}
            className="btn btn-primary !py-1 text-sm"
            onClick={() =>
              startTransition(async () => {
                const res = await applyRoomTemplateToRoom(containerId, tpl.id, roomId);
                setMsg(res?.error ?? 'Appliqué !');
              })
            }
          >
            Appliquer
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-[var(--text-muted)]">{msg}</p>}

      <div className="flex flex-wrap gap-2 text-xs">
        {canManage && (
          <button
            className="text-[var(--text-muted)] hover:underline"
            onClick={() => startTransition(() => void duplicateRoomTemplate(containerId, tpl.id))}
          >
            Dupliquer
          </button>
        )}
        {isOwner && tpl.visibility !== 'public' && (
          <button
            className="text-[var(--text-muted)] hover:underline"
            onClick={() => startTransition(() => void publishRoomTemplate(containerId, tpl.id))}
          >
            Publier sur la marketplace
          </button>
        )}
        {isOwner && (
          <button
            className="text-fresh-low hover:underline"
            onClick={() => {
              if (window.confirm('Supprimer ce template ?')) startTransition(() => deleteRoomTemplate(containerId, tpl.id));
            }}
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

function NewTemplateForm({ containerId, onDone }: { containerId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🧹');
  const [visibility, setVisibility] = useState<'personal' | 'container'>('personal');
  const [items, setItems] = useState<TemplateItemInput[]>([
    { title: '', recurrence_type: 'weekly', recurrence_interval: 1, priority: 'medium', freshness_days: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateItem(i: number, patch: Partial<TemplateItemInput>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function submit() {
    const cleanItems = items.filter((it) => it.title.trim());
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    startTransition(async () => {
      const res = await createRoomTemplate(containerId, { name, icon, visibility, items: cleanItems });
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cave" className="input mt-1" />
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
        <span className="text-sm font-medium">Tâches du template</span>
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => updateItem(i, { title: e.target.value })}
              placeholder="Nettoyer les étagères"
              className="input flex-1 !py-1 text-sm"
            />
            <select
              value={item.recurrence_type}
              onChange={(e) => updateItem(i, { recurrence_type: e.target.value as RecurrenceType })}
              className="input !py-1 text-sm"
            >
              <option value="none">Ponctuelle</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
              <option value="custom_days">Tous les X jours</option>
            </select>
            <select
              value={item.priority}
              onChange={(e) => updateItem(i, { priority: e.target.value as Priority })}
              className="input !py-1 text-sm"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
            <button
              className="text-xs text-fresh-low"
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="self-start text-xs text-[var(--text-muted)] hover:underline"
          onClick={() =>
            setItems((prev) => [...prev, { title: '', recurrence_type: 'weekly', recurrence_interval: 1, priority: 'medium', freshness_days: null }])
          }
        >
          + tâche
        </button>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary" onClick={submit}>
          Créer le template
        </button>
        <button className="btn btn-ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function TemplatesClient({
  containerId,
  system,
  container,
  personal,
  marketplace,
  rooms,
  canManage,
  currentUserId,
}: {
  containerId: string;
  system: TemplateSummary[];
  container: TemplateSummary[];
  personal: TemplateSummary[];
  marketplace: TemplateSummary[];
  rooms: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);

  const sections: { title: string; items: TemplateSummary[] }[] = [
    { title: 'Mes templates', items: personal },
    { title: 'Partagés dans ce conteneur', items: container },
    { title: 'Bibliothèque système (par pièce)', items: system },
    { title: 'Marketplace communautaire', items: marketplace },
  ];

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div>
          {!showForm ? (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Nouveau template
            </button>
          ) : (
            <NewTemplateForm containerId={containerId} onDone={() => setShowForm(false)} />
          )}
        </div>
      )}

      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <div key={s.title}>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{s.title}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} containerId={containerId} rooms={rooms} canManage={canManage} currentUserId={currentUserId} />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}
