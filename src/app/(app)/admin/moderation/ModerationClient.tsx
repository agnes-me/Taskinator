'use client';

import { useTransition } from 'react';
import { moderateTemplate, deletePublishedTemplate } from './actions';

type Item = { id: string; name: string; icon: string; created_by: string | null };

export function ModerationClient({
  pendingRoomTemplates,
  pendingEventTemplates,
  publishedRoomTemplates,
  publishedEventTemplates,
}: {
  pendingRoomTemplates: Item[];
  pendingEventTemplates: Item[];
  publishedRoomTemplates: Item[];
  publishedEventTemplates: Item[];
}) {
  const [pending, startTransition] = useTransition();

  function PendingRow({ item, kind }: { item: Item; kind: 'room' | 'event' }) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
        <span>
          {item.icon} {item.name}
        </span>
        <div className="flex gap-2">
          <button
            disabled={pending}
            className="btn btn-primary !py-1 text-sm"
            onClick={() => startTransition(() => void moderateTemplate(kind, item.id, 'approved'))}
          >
            Approuver
          </button>
          <button
            disabled={pending}
            className="btn btn-ghost !py-1 text-sm text-fresh-low"
            onClick={() => startTransition(() => void moderateTemplate(kind, item.id, 'rejected'))}
          >
            Refuser
          </button>
        </div>
      </li>
    );
  }

  function PublishedRow({ item, kind }: { item: Item; kind: 'room' | 'event' }) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
        <span>
          {item.icon} {item.name}
        </span>
        <button
          disabled={pending}
          className="btn btn-ghost !py-1 text-sm text-fresh-low"
          onClick={() => {
            if (window.confirm(`Retirer « ${item.name} » de la marketplace ?`)) {
              startTransition(() => void deletePublishedTemplate(kind, item.id));
            }
          }}
        >
          Supprimer
        </button>
      </li>
    );
  }

  const nothingPending = pendingRoomTemplates.length === 0 && pendingEventTemplates.length === 0;
  const nothingPublished = publishedRoomTemplates.length === 0 && publishedEventTemplates.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-2 font-semibold">⏳ En attente de modération</h2>
        {nothingPending ? (
          <p className="card p-4 text-sm text-[var(--text-muted)]">Rien à modérer pour l'instant. 🎉</p>
        ) : (
          <div className="flex flex-col gap-6">
            {pendingRoomTemplates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Templates de catégorie</h3>
                <ul className="flex flex-col gap-2">
                  {pendingRoomTemplates.map((t) => (
                    <PendingRow key={t.id} item={t} kind="room" />
                  ))}
                </ul>
              </div>
            )}
            {pendingEventTemplates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Templates d'événement</h3>
                <ul className="flex flex-col gap-2">
                  {pendingEventTemplates.map((t) => (
                    <PendingRow key={t.id} item={t} kind="event" />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">🛒 Déjà sur la marketplace</h2>
        {nothingPublished ? (
          <p className="card p-4 text-sm text-[var(--text-muted)]">Rien de publié pour l'instant.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {publishedRoomTemplates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Templates de catégorie</h3>
                <ul className="flex flex-col gap-2">
                  {publishedRoomTemplates.map((t) => (
                    <PublishedRow key={t.id} item={t} kind="room" />
                  ))}
                </ul>
              </div>
            )}
            {publishedEventTemplates.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Templates d'événement</h3>
                <ul className="flex flex-col gap-2">
                  {publishedEventTemplates.map((t) => (
                    <PublishedRow key={t.id} item={t} kind="event" />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
