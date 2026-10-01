'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FreshnessBar } from '@/components/FreshnessBar';
import type { RoomWithFreshness } from '@/lib/data/rooms';
import type { EventsCountSummary } from '@/lib/data/events';
import { createRoom, updateRoom, deleteRoom, pauseContainer, resumeContainer } from './actions';

const ICONS = [
  '🍳', '🛁', '🛏️', '🛋️', '🚪', '🖥️', '🧺', '🚗', '🌿', '🏊', '🧹',
  '💼', '📊', '💻', '📁', '💰', '🧾', '🏦', '💊', '🏥', '🧘',
  '👶', '🧸', '🎒', '🐶', '🐱', '🛒', '🛍️', '🌳', '🌱', '🚲',
  '✈️', '🧳', '🗺️', '🎉', '🎂', '🎁', '📅', '📦', '🔧', '🎨',
  '📚', '🎵', '⚽', '🍽️', '📱', '⭐',
];

function EventsCard({ containerId, eventsSummary }: { containerId: string; eventsSummary: EventsCountSummary }) {
  return (
    <Link href={`/c/${containerId}/events`} className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-xl">🎉</span> Événements
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        {eventsSummary.total === 0
          ? 'Aucun événement pour l’instant'
          : `${eventsSummary.upcoming} événement${eventsSummary.upcoming > 1 ? 's' : ''} à venir sur ${eventsSummary.total}`}
      </p>
    </Link>
  );
}

function RoomCard({
  room,
  containerId,
  canEdit,
}: {
  room: RoomWithFreshness;
  containerId: string;
  canEdit: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, startTransition] = useTransition();
  const canConfirm = confirmText.trim().toLowerCase() === room.name.trim().toLowerCase();

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        {editing ? (
          <form
            className="flex flex-1 flex-wrap items-end gap-2"
            action={(fd) =>
              startTransition(async () => {
                const res = await updateRoom(containerId, room.id, fd);
                if (res?.error) setEditError(res.error);
                else {
                  setEditing(false);
                  setEditError(null);
                }
              })
            }
          >
            <select name="icon" defaultValue={room.icon} className="input !py-1 text-sm">
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <input name="name" required defaultValue={room.name} className="input !py-1 flex-1 text-sm" autoFocus />
            <button type="submit" disabled={pending} className="btn btn-primary !px-2 !py-1 text-xs">
              OK
            </button>
            <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(false)}>
              ✕
            </button>
            {editError && <p className="w-full text-xs text-fresh-low">{editError}</p>}
          </form>
        ) : (
          <Link href={`/c/${containerId}/rooms/${room.id}`} className="flex items-center gap-2 font-semibold hover:underline">
            <span className="text-xl">{room.icon}</span> {room.name}
          </Link>
        )}
        {canEdit && !editing && (
          <div className="relative">
            <button
              className="rounded-lg px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Options de la catégorie"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="card absolute right-0 top-full z-10 mt-1 w-40 p-1 shadow-lg">
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                >
                  Modifier…
                </button>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-fresh-low hover:bg-[var(--surface-muted)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirming(true);
                  }}
                >
                  Supprimer…
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {confirming && (
        <div className="flex flex-col gap-2 rounded-lg border border-fresh-low/40 bg-fresh-low/5 p-3 text-sm">
          <p>
            Pour confirmer, tape le nom de la catégorie (<strong>{room.name}</strong>). Les tâches associées seront conservées
            mais ne seront plus rattachées à une catégorie.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={room.name}
            className="input !py-1 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              disabled={!canConfirm || pending}
              className="btn btn-primary !bg-fresh-low !py-1 text-sm disabled:opacity-40"
              onClick={() => startTransition(() => deleteRoom(containerId, room.id))}
            >
              Supprimer définitivement
            </button>
            <button
              className="btn btn-ghost !py-1 text-sm"
              onClick={() => {
                setConfirming(false);
                setConfirmText('');
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <FreshnessBar freshness={room.freshness} />
      <p className="text-xs text-[var(--text-muted)]">
        {room.taskCount} tâche{room.taskCount > 1 ? 's' : ''} récurrente{room.taskCount > 1 ? 's' : ''}
        {room.paused_until && new Date(room.paused_until) > new Date() ? ' · ⏸ en pause' : ''}
      </p>
    </div>
  );
}

export function RoomsClient({
  containerId,
  rooms,
  canEdit,
  containerPausedUntil,
  eventsSummary,
}: {
  containerId: string;
  rooms: RoomWithFreshness[];
  canEdit: boolean;
  containerPausedUntil: string | null;
  eventsSummary: EventsCountSummary;
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
            + Nouvelle catégorie
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
            Fraîcheur par défaut (jours)
            <input name="freshnessDays" type="number" min={1} defaultValue={7} className="input mt-1 w-24" />
          </label>
          <button type="submit" disabled={pending} className="btn btn-primary">
            Créer
          </button>
          <p className="w-full text-xs text-[var(--text-muted)]">
            Délai par défaut, en jours, avant qu'une tâche récurrente de cette catégorie soit considérée « à refaire » (sert à
            l'indicateur de fraîcheur de la catégorie) — chaque tâche peut ensuite avoir son propre délai.
          </p>
          {error && <p className="w-full text-sm text-fresh-low">{error}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EventsCard containerId={containerId} eventsSummary={eventsSummary} />
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} containerId={containerId} canEdit={canEdit} />
        ))}
      </div>

      {rooms.length === 0 && (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">
          Aucune catégorie pour l'instant. Créez-en une, ou appliquez un template depuis « ⚙️ Paramètres ».
        </p>
      )}
    </div>
  );
}
