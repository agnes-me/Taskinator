'use client';

import { useState, useTransition } from 'react';
import type { ChecklistTemplate } from '@/lib/data/checklist';
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  getChecklistTemplateItemsForEdit,
  type ChecklistTemplateItemDraft,
} from '../tasks/checklist-actions';

const ICONS = ['🛒', '🎁', '📋', '🧳', '🎂', '🍽️', '🧹', '📦'];

function TreeNode({
  item,
  items,
  depth,
  onAddChild,
  onChangeLabel,
  onRemove,
}: {
  item: ChecklistTemplateItemDraft;
  items: ChecklistTemplateItemDraft[];
  depth: number;
  onAddChild: (parentId: string) => void;
  onChangeLabel: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const children = items.filter((it) => it.parentId === item.id);
  return (
    <>
      <div className="flex items-center gap-1" style={{ marginLeft: depth * 18 }}>
        <input
          value={item.label}
          onChange={(e) => onChangeLabel(item.id, e.target.value)}
          placeholder="Article"
          className="input flex-1 !py-1 text-sm"
        />
        <button type="button" className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => onAddChild(item.id)} title="Ajouter une sous-case">
          +
        </button>
        <button type="button" className="text-xs text-fresh-low" onClick={() => onRemove(item.id)}>
          ✕
        </button>
      </div>
      {children.map((c) => (
        <TreeNode key={c.id} item={c} items={items} depth={depth + 1} onAddChild={onAddChild} onChangeLabel={onChangeLabel} onRemove={onRemove} />
      ))}
    </>
  );
}

function ChecklistTemplateForm({
  containerId,
  templateId,
  initialName,
  initialIcon,
  initialItems,
  onDone,
  onCancel,
}: {
  containerId: string;
  templateId?: string;
  initialName?: string;
  initialIcon?: string;
  initialItems?: ChecklistTemplateItemDraft[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(templateId);
  const [name, setName] = useState(initialName ?? '');
  const [icon, setIcon] = useState(initialIcon ?? '🛒');
  const [items, setItems] = useState<ChecklistTemplateItemDraft[]>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addItem(parentId: string | null) {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), parentId, label: '' }]);
  }

  function changeLabel(id: string, label: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, label } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const toRemove = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const it of prev) {
          if (it.parentId && toRemove.has(it.parentId) && !toRemove.has(it.id)) {
            toRemove.add(it.id);
            grew = true;
          }
        }
      }
      return prev.filter((it) => !toRemove.has(it.id));
    });
  }

  function submit() {
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    startTransition(async () => {
      const res =
        isEdit && templateId
          ? await updateChecklistTemplate(containerId, templateId, name, icon, items)
          : await createChecklistTemplate(containerId, name, icon, items);
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  const roots = items.filter((it) => !it.parentId);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Courses hebdo" className="input mt-1" />
        </label>
        <label className="text-sm">
          Icône
          <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input mt-1">
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Articles (avec ou sans sous-cases)</span>
        <div className="flex flex-col gap-1.5">
          {roots.map((item) => (
            <TreeNode key={item.id} item={item} items={items} depth={0} onAddChild={addItem} onChangeLabel={changeLabel} onRemove={removeItem} />
          ))}
        </div>
        <button type="button" className="self-start text-xs text-[var(--text-muted)] hover:underline" onClick={() => addItem(null)}>
          + article
        </button>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary" onClick={submit}>
          {isEdit ? 'Enregistrer' : 'Créer le template'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function TemplateCard({ tpl, containerId, canManage }: { tpl: ChecklistTemplate; containerId: string; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<ChecklistTemplateItemDraft[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEdit() {
    startTransition(async () => {
      const res = await getChecklistTemplateItemsForEdit(tpl.id);
      if ('error' in res) setLoadError(res.error);
      else {
        setEditItems(res.items.map((it) => ({ id: it.id, parentId: it.parent_item_id, label: it.label })));
        setEditing(true);
      }
    });
  }

  if (editing && editItems) {
    return (
      <ChecklistTemplateForm
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

  return (
    <div className="card flex flex-col gap-2 p-4">
      <span className="font-semibold">
        {tpl.icon} {tpl.name}
      </span>
      <p className="text-xs text-[var(--text-muted)]">{tpl.itemCount} article(s)</p>
      {loadError && <p className="text-xs text-fresh-low">{loadError}</p>}
      {canManage && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button disabled={pending} className="text-[var(--text-muted)] hover:underline" onClick={openEdit}>
            Voir / Modifier
          </button>
          <button
            className="text-fresh-low hover:underline"
            onClick={() => {
              if (window.confirm('Supprimer ce template ?')) startTransition(() => deleteChecklistTemplate(containerId, tpl.id));
            }}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

export function ChecklistTemplatesClient({
  containerId,
  templates,
  canManage,
}: {
  containerId: string;
  templates: ChecklistTemplate[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[var(--text-muted)]">
        Des listes de courses/cadeaux réutilisables, avec ou sans sous-cases, à appliquer sur n'importe quelle tâche.
      </p>
      {canManage && (
        <div>
          {!showForm ? (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Nouveau template de liste
            </button>
          ) : (
            <ChecklistTemplateForm containerId={containerId} onDone={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
          )}
        </div>
      )}

      {templates.length === 0 ? (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">Aucun template de liste pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} containerId={containerId} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
