'use client';

import { useState, useTransition } from 'react';
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  applyChecklistTemplate,
  saveChecklistAsTemplate,
} from '@/app/(app)/c/[containerId]/tasks/checklist-actions';
import type { ChecklistItem, ChecklistTemplate } from '@/lib/data/checklist';

const NO_GROUP = '__sans_groupe__';

export function ChecklistSection({
  taskId,
  containerId,
  items,
  canEdit,
  templates,
}: {
  taskId: string;
  containerId: string;
  items: ChecklistItem[];
  canEdit: boolean;
  templates: ChecklistTemplate[];
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0 && !canEdit) return null;

  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const key = item.group_name || NO_GROUP;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const doneCount = items.filter((i) => i.checked).length;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          🛒 Liste{items.length > 0 && ` (${doneCount}/${items.length})`}
        </span>
        {canEdit && templates.length > 0 && (
          <select
            className="input !py-1 text-xs"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const templateId = e.target.value;
              if (!templateId) return;
              startTransition(async () => {
                await applyChecklistTemplate(taskId, containerId, templateId);
              });
              e.target.value = '';
            }}
          >
            <option value="">Appliquer un template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name} ({t.itemCount})
              </option>
            ))}
          </select>
        )}
      </div>

      {[...groups.entries()].map(([group, groupItems]) => (
        <div key={group} className="flex flex-col gap-1">
          {group !== NO_GROUP && <span className="text-xs font-semibold text-[var(--text-muted)]">{group}</span>}
          {groupItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <button
                disabled={!canEdit || pending}
                onClick={() => startTransition(() => toggleChecklistItem(item.id, containerId, !item.checked))}
                className="btn btn-ghost !px-1.5 !py-0.5 text-xs disabled:opacity-40"
              >
                {item.checked ? '✅' : '⬜️'}
              </button>
              <span className={`flex-1 ${item.checked ? 'line-through opacity-60' : ''}`}>{item.label}</span>
              {canEdit && (
                <button
                  className="text-xs text-[var(--text-muted)] hover:text-fresh-low"
                  onClick={() => startTransition(() => deleteChecklistItem(item.id, containerId))}
                  aria-label="Supprimer l'article"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      {canEdit && (
        <>
          {!adding ? (
            <button className="self-start text-xs text-[var(--text-muted)] hover:underline" onClick={() => setAdding(true)}>
              + article
            </button>
          ) : (
            <form
              className="flex flex-wrap items-center gap-1"
              action={(fd) =>
                startTransition(async () => {
                  const res = await addChecklistItem(taskId, containerId, fd);
                  if (res?.error) setError(res.error);
                  else {
                    setError(null);
                    setAdding(false);
                  }
                })
              }
            >
              <input name="label" required autoFocus placeholder="Article" className="input !py-1 w-28 text-xs" />
              <input name="groupName" placeholder="Groupe (optionnel)" className="input !py-1 w-28 text-xs" />
              <button type="submit" disabled={pending} className="btn btn-primary !px-2 !py-1 text-xs">
                Ajouter
              </button>
              <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setAdding(false)}>
                ✕
              </button>
            </form>
          )}

          {items.length > 0 && !savingTemplate && (
            <button className="self-start text-xs text-[var(--text-muted)] hover:underline" onClick={() => setSavingTemplate(true)}>
              Enregistrer comme template…
            </button>
          )}
          {savingTemplate && (
            <form
              className="flex flex-wrap items-center gap-1"
              action={(fd) =>
                startTransition(async () => {
                  const name = String(fd.get('name') ?? '');
                  const res = await saveChecklistAsTemplate(containerId, taskId, name);
                  if (res?.error) setError(res.error);
                  else {
                    setError(null);
                    setSavingTemplate(false);
                  }
                })
              }
            >
              <input name="name" required autoFocus placeholder="Nom du template" className="input !py-1 w-40 text-xs" />
              <button type="submit" disabled={pending} className="btn btn-primary !px-2 !py-1 text-xs">
                Enregistrer
              </button>
              <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setSavingTemplate(false)}>
                ✕
              </button>
            </form>
          )}

          {error && <p className="text-xs text-fresh-low">{error}</p>}
        </>
      )}
    </div>
  );
}
