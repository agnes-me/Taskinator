'use client';

import { useTransition } from 'react';
import { moderateTemplate } from './actions';

type Item = { id: string; name: string; icon: string; created_by: string | null };

export function ModerationClient({ roomTemplates, eventTemplates }: { roomTemplates: Item[]; eventTemplates: Item[] }) {
  const [pending, startTransition] = useTransition();

  function Row({ item, kind }: { item: Item; kind: 'room' | 'event' }) {
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

  if (roomTemplates.length === 0 && eventTemplates.length === 0) {
    return <p className="card p-6 text-center text-sm text-[var(--text-muted)]">Rien à modérer pour l'instant. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {roomTemplates.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Templates de pièce en attente</h2>
          <ul className="flex flex-col gap-2">
            {roomTemplates.map((t) => (
              <Row key={t.id} item={t} kind="room" />
            ))}
          </ul>
        </div>
      )}
      {eventTemplates.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Templates d'événement en attente</h2>
          <ul className="flex flex-col gap-2">
            {eventTemplates.map((t) => (
              <Row key={t.id} item={t} kind="event" />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
