'use client';

import { useState, useTransition } from 'react';
import { saveTaskAsRoomTemplate } from '@/app/(app)/c/[containerId]/templates/actions';
import type { TemplateVisibility } from '@/types/database';

const ICONS = ['📋', '🎒', '🎁', '🛒', '🧹', '🎉', '📅', '✅'];

export function SaveTaskAsTemplateButton({ taskId, containerId, defaultName }: { taskId: string; containerId: string; defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="self-start text-xs text-[var(--text-muted)] hover:underline" onClick={() => setOpen(true)}>
        💾 Enregistrer comme template
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <form
        className="flex flex-wrap items-center gap-1"
        action={(fd) =>
          startTransition(async () => {
            const name = String(fd.get('name') ?? '');
            const icon = String(fd.get('icon') ?? '📋');
            const visibility = String(fd.get('visibility') ?? 'personal') as TemplateVisibility;
            const res = await saveTaskAsRoomTemplate(containerId, taskId, { name, icon, visibility });
            if (res?.error) setError(res.error);
            else {
              setError(null);
              setOpen(false);
            }
          })
        }
      >
        <select name="icon" defaultValue="📋" className="input !py-1 text-xs">
          {ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <input name="name" required defaultValue={defaultName} className="input !py-1 w-36 text-xs" />
        <select name="visibility" defaultValue="personal" className="input !py-1 text-xs">
          <option value="personal">Personnel</option>
          <option value="container">Ce conteneur</option>
          <option value="public">Marketplace (soumis à modération)</option>
        </select>
        <button type="submit" disabled={pending} className="btn btn-primary !px-2 !py-1 text-xs">
          Enregistrer
        </button>
        <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setOpen(false)}>
          ✕
        </button>
      </form>
      {error && <p className="text-xs text-fresh-low">{error}</p>}
    </div>
  );
}
