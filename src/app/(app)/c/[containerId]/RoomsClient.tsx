'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FreshnessBar } from '@/components/FreshnessBar';
import type { RoomWithFreshness } from '@/lib/data/rooms';
import { createRoom, deleteRoom, pauseContainer, resumeContainer } from './actions';

const ICONS = ['🍳', '🛁', '🛏️', '🛋️', '🚪', '🖥️', '🧺', '🚗', '🌿', '🏊', '🧹'];

export function RoomsClient({
  containerId,
  rooms,
  canEdit,
  containerPausedUntil,
}: {
  containerId: string;
  rooms: RoomWithFreshness[];
  canEdit: boolean;
  containerPausedUntil: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerPaused = containerPausedUntil && new Date(containerPausedUntil) > new Date();

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-[var(--text-muted)]">
            {containerPaused ? (
              <button
                className="chip bg-fresh-mid/20 text-fresh-mid"
                onClick={() => startTransition(() => resumeContainer(containerId))}
              >
                ⏸ En pause — cliquer pour reprendre
              </button>
            ) : (
              <button
                className="chip bg-[var(--surface-muted)]"
                onClick={() => {
                  const days = window.prompt('Mettre en pause tout le conteneur pendant combien de jours ?', '14');
                  if (!days) return;
                  const until = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
                  startTransition(() => pauseContainer(containerId, until, 'Vacances'));
                }}
              >
                Mettre le conteneur en pause (vacances…)
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            + Nouvelle pièce
          </button>
        </div>
      )}

      {showForm && canEdit && (
        <form
          className="card flex flex-wrap items-end gap-3 p-4"
          action={(fd) =>
            startTransition(async () => {
              const res = await createRoom(containerId, fd);
              if (res?.error) setError(res.error);
              else {
                setShowForm(false);
                setError(null);
              }
            })
          }
        >
          <label className="text-sm">
            Nom
            <input name="name" required placeholder="Cuisine" className="input mt-1" />
          </label>
          <label className="text-sm">
            Icône
            <select name="icon" className="input mt-1">
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Validité (jours)
            <input name="freshnessDays" type="number" min={1} defaultValue={7} className="input mt-1 w-24" />
          </label>
          <button type="submit" disabled={pending} className="btn btn-primary">
            Créer
          </button>
          {error && <p className="w-full text-sm text-fresh-low">{error}</p>}
        </form>
      )}

      {rooms.length === 0 ? (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune pièce pour l'instant. Créez-en une, ou appliquez un template depuis l'onglet Templates.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div key={room.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <Link href={`/c/${containerId}/rooms/${room.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                  <span className="text-xl">{room.icon}</span> {room.name}
                </Link>
                {canEdit && (
                  <button
                    className="text-xs text-[var(--text-muted)] hover:text-fresh-low"
                    onClick={() => {
                      if (window.confirm(`Supprimer la pièce « ${room.name} » ?`)) startTransition(() => deleteRoom(containerId, room.id));
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <FreshnessBar freshness={room.freshness} />
              <p className="text-xs text-[var(--text-muted)]">
                {room.taskCount} tâche{room.taskCount > 1 ? 's' : ''} récurrente{room.taskCount > 1 ? 's' : ''}
                {room.paused_until && new Date(room.paused_until) > new Date() ? ' · ⏸ en pause' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
