'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ContainerNote } from '@/lib/data/notes';
import { formatDateTime } from '@/lib/utils';
import { createNote, updateNote, deleteNote, uploadNoteImage, deleteNoteImage, exportNotesMarkdown } from './actions';

function NoteCard({ note, containerId, canEdit }: { note: ContainerNote; containerId: string; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = note.content.replace(/\s+/g, ' ').trim().slice(0, 140);

  function save() {
    startTransition(async () => {
      const res = await updateNote(containerId, note.id, title, content);
      if (res?.error) setError(res.error);
      else setError(null);
    });
  }

  function uploadImage(file: File) {
    const fd = new FormData();
    fd.set('image', file);
    startTransition(async () => {
      const res = await uploadNoteImage(containerId, note.id, fd);
      if (res?.error) setError(res.error);
      else setError(null);
    });
  }

  if (!expanded) {
    return (
      <button className="card flex w-full flex-col items-start gap-1 p-3 text-left" onClick={() => setExpanded(true)}>
        <span className="font-semibold">{note.title}</span>
        {preview && <span className="text-sm text-[var(--text-muted)]">{preview}{note.content.length > 140 ? '…' : ''}</span>}
        <span className="text-xs text-[var(--text-muted)]">
          {note.images.length > 0 && `🖼️ ${note.images.length} · `}
          Modifiée {note.updated_by_name ? `par ${note.updated_by_name} ` : ''}le {formatDateTime(note.updated_at)}
        </span>
      </button>
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      {canEdit ? (
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input font-semibold" placeholder="Titre" />
      ) : (
        <span className="font-semibold">{note.title}</span>
      )}

      {canEdit ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="input min-h-[30vh] w-full font-mono text-sm"
          placeholder="Contenu (Markdown)…"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{note.content || '—'}</p>
      )}

      {note.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {note.images.map((img) => (
            <div key={img.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-24 w-24 rounded-lg border border-[var(--border)] object-cover" />
              {canEdit && (
                <button
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                  onClick={() => startTransition(() => deleteNoteImage(containerId, img.id))}
                  aria-label="Supprimer l'image"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} className="btn btn-primary" onClick={save}>
            Enregistrer
          </button>
          <label className="btn btn-ghost cursor-pointer">
            🖼️ + image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
                e.target.value = '';
              }}
            />
          </label>
          <button className="btn btn-ghost" onClick={() => setExpanded(false)}>
            Replier
          </button>
          {!confirmingDelete ? (
            <button className="btn btn-ghost ml-auto text-fresh-low" onClick={() => setConfirmingDelete(true)}>
              Supprimer
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs">
              <button
                className="btn btn-primary !bg-fresh-low text-xs"
                onClick={() => startTransition(() => deleteNote(containerId, note.id))}
              >
                Confirmer
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setConfirmingDelete(false)}>
                Annuler
              </button>
            </span>
          )}
        </div>
      )}
      {!canEdit && (
        <button className="btn btn-ghost self-start" onClick={() => setExpanded(false)}>
          Replier
        </button>
      )}
      {error && <p className="text-sm text-fresh-low">{error}</p>}
    </div>
  );
}

export function NotesClient({ containerId, notes, canEdit }: { containerId: string; notes: ContainerNote[]; canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, query]);

  function create() {
    startTransition(async () => {
      await createNote(containerId, newTitle);
      setNewTitle('');
      setCreating(false);
    });
  }

  async function exportMarkdown() {
    setExporting(true);
    const res = await exportNotesMarkdown(containerId);
    setExporting(false);
    if ('error' in res) return;
    const blob = new Blob([res.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">📝 Notes</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {canEdit ? 'Des notes partagées, modifiables par toutes les personnes du conteneur.' : 'Des notes partagées — en lecture seule pour les invité·es.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Rechercher dans les notes…"
          className="input min-w-[200px] flex-1"
        />
        <button disabled={exporting || notes.length === 0} className="btn btn-ghost" onClick={exportMarkdown}>
          {exporting ? 'Export…' : '⬇️ Exporter en .md'}
        </button>
      </div>

      {canEdit && (
        <div>
          {!creating ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Nouvelle note
            </button>
          ) : (
            <div className="card flex flex-wrap items-center gap-2 p-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titre de la note"
                className="input flex-1"
                autoFocus
              />
              <button disabled={pending} className="btn btn-primary" onClick={create}>
                Créer
              </button>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">
          {notes.length === 0 ? 'Aucune note pour l\'instant.' : 'Aucune note ne correspond à la recherche.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((n) => (
            <NoteCard key={n.id} note={n} containerId={containerId} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
