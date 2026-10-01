'use client';

import { useState, useTransition } from 'react';
import type { ContainerNotes } from '@/lib/data/notes';
import { formatDateTime } from '@/lib/utils';
import { updateContainerNotes } from './actions';

export function NotesClient({ containerId, notes, canEdit }: { containerId: string; notes: ContainerNotes; canEdit: boolean }) {
  const [content, setContent] = useState(notes.content);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateContainerNotes(containerId, content);
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setDirty(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">📝 Notes</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {canEdit ? 'Un bloc-notes partagé, visible et modifiable par toutes les personnes du conteneur.' : 'Un bloc-notes partagé — en lecture seule pour les invité·es.'}
        </p>
      </div>

      {canEdit ? (
        <div className="card flex flex-col gap-2 p-4">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            placeholder="Code du portail, numéro du plombier, idées de cadeaux…"
            className="input min-h-[50vh] w-full font-mono text-sm"
          />
          <div className="flex items-center gap-2">
            <button disabled={pending || !dirty} className="btn btn-primary" onClick={save}>
              Enregistrer
            </button>
            {notes.updated_at && (
              <span className="text-xs text-[var(--text-muted)]">
                Dernière modif {notes.updated_by_name ? `par ${notes.updated_by_name} ` : ''}
                le {formatDateTime(notes.updated_at)}
              </span>
            )}
          </div>
          {error && <p className="text-sm text-fresh-low">{error}</p>}
        </div>
      ) : (
        <div className="card p-4">
          {notes.content ? (
            <p className="whitespace-pre-wrap text-sm">{notes.content}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Aucune note pour l'instant.</p>
          )}
          {notes.updated_at && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Dernière modif {notes.updated_by_name ? `par ${notes.updated_by_name} ` : ''}
              le {formatDateTime(notes.updated_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
