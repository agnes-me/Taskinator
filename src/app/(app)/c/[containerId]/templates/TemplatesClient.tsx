'use client';

import { useState, useTransition } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import type { Priority, RecurrenceType } from '@/types/database';
import { recurrenceLabel, PRIORITY_LABELS } from '@/lib/recurrence';
import {
  createRoomTemplate,
  createRoomFromTemplate,
  deleteRoomTemplate,
  duplicateRoomTemplate,
  publishRoomTemplate,
  applyRoomTemplateToRoom,
  getRoomTemplateItems,
  updateRoomTemplate,
  type TemplateItemInput,
} from './actions';

const MODERATION_LABEL: Record<string, string> = {
  draft: '',
  pending: '⏳ En attente de modération',
  approved: '✅ Publié',
  rejected: '❌ Refusé',
};

function TemplatePreview({ items, onClose }: { items: TemplateItemInput[]; onClose: () => void }) {
  const roots = items.filter((it) => !it.parent_item_id);
  const childrenOf = (id: string | undefined) => items.filter((it) => it.parent_item_id === id);

  function ItemLine({ item, depth }: { item: TemplateItemInput; depth: number }) {
    const children = item.id ? childrenOf(item.id) : [];
    return (
      <>
        <div className="flex items-center gap-2 text-sm" style={{ marginLeft: depth * 16 }}>
          <span className="flex-1">{item.title}</span>
          <span className="chip bg-[var(--surface-muted)] text-xs">{recurrenceLabel(item.recurrence_type, item.recurrence_interval, null)}</span>
          <span className="chip bg-[var(--surface-muted)] text-xs">{PRIORITY_LABELS[item.priority]}</span>
        </div>
        {children.map((c) => (
          <ItemLine key={c.id} item={c} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Contenu du template</span>
        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={onClose}>
          Fermer
        </button>
      </div>
      {roots.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Ce template est vide.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {roots.map((item) => (
            <ItemLine key={item.id} item={item} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [mode, setMode] = useState<'existing' | 'new'>(rooms.length > 0 ? 'existing' : 'new');
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [newRoomName, setNewRoomName] = useState(tpl.name);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editItems, setEditItems] = useState<TemplateItemInput[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isOwner = tpl.created_by === currentUserId;

  function apply() {
    startTransition(async () => {
      const res =
        mode === 'existing'
          ? await applyRoomTemplateToRoom(containerId, tpl.id, roomId)
          : await createRoomFromTemplate(containerId, tpl.id, newRoomName, tpl.icon);
      setMsg(res?.error ?? 'Appliqué !');
    });
  }

  // Tout le monde peut voir le contenu complet d'un template avant de l'appliquer (RLS l'autorise
  // déjà, room_template_visible) ; seule la propriétaire du template peut ensuite le modifier.
  function openView() {
    startTransition(async () => {
      const res = await getRoomTemplateItems(tpl.id);
      if ('error' in res) setLoadError(res.error);
      else {
        setEditItems(res.items);
        if (isOwner) setEditing(true);
        else setPreviewing(true);
      }
    });
  }

  if (editing && editItems) {
    return (
      <RoomTemplateForm
        containerId={containerId}
        templateId={tpl.id}
        initialName={tpl.name}
        initialIcon={tpl.icon}
        initialItems={editItems}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (previewing && editItems) {
    return <TemplatePreview items={editItems} onClose={() => setPreviewing(false)} />;
  }

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
      {loadError && <p className="text-xs text-fresh-low">{loadError}</p>}

      {canManage && (
        <div className="flex flex-col gap-2">
          {rooms.length > 0 && (
            <div className="flex gap-3 text-xs text-[var(--text-muted)]">
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} /> Catégorie existante
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Nouvelle catégorie
              </label>
            </div>
          )}
          <div className="flex items-center gap-2">
            {mode === 'existing' && rooms.length > 0 ? (
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input !py-1 text-sm">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Nom de la nouvelle catégorie"
                className="input !py-1 flex-1 text-sm"
              />
            )}
            <button
              disabled={pending || (mode === 'existing' ? !roomId : !newRoomName.trim())}
              className="btn btn-primary !py-1 text-sm"
              onClick={apply}
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-[var(--text-muted)]">{msg}</p>}

      <div className="flex flex-wrap gap-2 text-xs">
        <button className="text-[var(--text-muted)] hover:underline" onClick={openView}>
          {isOwner ? 'Voir / Modifier' : 'Voir le contenu'}
        </button>
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

function RoomTemplateForm({
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
  initialItems?: TemplateItemInput[];
}) {
  const isEdit = Boolean(templateId);
  const [name, setName] = useState(initialName ?? '');
  const [icon, setIcon] = useState(initialIcon ?? '🧹');
  const [visibility, setVisibility] = useState<'personal' | 'container'>('personal');
  const [items, setItems] = useState<TemplateItemInput[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [{ title: '', recurrence_type: 'weekly', recurrence_interval: 1, priority: 'medium', freshness_days: null }],
  );
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
      const res =
        isEdit && templateId
          ? await updateRoomTemplate(containerId, templateId, { name, icon, items: cleanItems })
          : await createRoomTemplate(containerId, { name, icon, visibility, items: cleanItems });
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
        <span className="text-sm font-medium">Tâches du template</span>
        <div className="hidden flex-wrap gap-2 text-xs text-[var(--text-muted)] sm:flex">
          <span className="flex-1">Titre</span>
          <span className="w-[148px]">Récurrence</span>
          <span className="w-[110px]">Difficulté</span>
          <span className="w-4" />
        </div>
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => updateItem(i, { title: e.target.value })}
              placeholder="Nettoyer les étagères"
              className="input flex-1 !py-1 text-sm"
            />
            <select
              aria-label="Récurrence"
              value={item.recurrence_type}
              onChange={(e) => updateItem(i, { recurrence_type: e.target.value as RecurrenceType })}
              className="input w-[148px] !py-1 text-sm"
            >
              <option value="none">Ponctuelle</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
              <option value="custom_days">Tous les X jours</option>
            </select>
            <select
              aria-label="Difficulté"
              value={item.priority}
              onChange={(e) => updateItem(i, { priority: e.target.value as Priority })}
              className="input w-[110px] !py-1 text-sm"
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
          {isEdit ? 'Enregistrer' : 'Créer le template'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel ?? onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function TemplatesClient({
  containerId,
  container,
  personal,
  marketplace,
  rooms,
  canManage,
  currentUserId,
}: {
  containerId: string;
  container: TemplateSummary[];
  personal: TemplateSummary[];
  marketplace: TemplateSummary[];
  rooms: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);

  // La marketplace regroupe la bibliothèque officielle et les templates communautaires publiés
  // (même chose du point de vue de la consultation) : visible à toute membre du conteneur, pas
  // seulement à qui peut gérer les catégories — "Voir le contenu" permet de tout inspecter avant
  // application.
  const sections: { title: string; items: TemplateSummary[] }[] = [
    { title: 'Mes templates', items: personal },
    { title: 'Partagés dans ce conteneur', items: container },
    { title: '🛍️ Marketplace', items: marketplace },
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
            <RoomTemplateForm containerId={containerId} onDone={() => setShowForm(false)} />
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
