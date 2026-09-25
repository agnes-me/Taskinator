'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  listMyGoogleCalendarsForSync,
  removeContainerGoogleSync,
  setContainerGoogleSync,
  setContainerGoogleSyncEnabled,
} from './google-sync-actions';

export interface ContainerGoogleSync {
  google_calendar_id: string;
  enabled: boolean;
}

export function GoogleSyncForm({ containerId, googleConnected, sync }: { containerId: string; googleConnected: boolean; sync: ContainerGoogleSync | null }) {
  const router = useRouter();
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[] | null>(null);
  const [selected, setSelected] = useState(sync?.google_calendar_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!googleConnected) return;
    startTransition(async () => {
      const res = await listMyGoogleCalendarsForSync();
      if ('error' in res) {
        setError(res.error);
      } else {
        setCalendars(res.calendars);
        if (!selected) setSelected(sync?.google_calendar_id ?? res.calendars[0]?.id ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected]);

  function activate() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await setContainerGoogleSync(containerId, selected);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function toggle(enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setContainerGoogleSyncEnabled(containerId, enabled);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm('Retirer la synchro vers Google Calendar pour ce conteneur ? Les événements déjà poussés restent sur Google Calendar.')) return;
    setError(null);
    startTransition(async () => {
      const res = await removeContainerGoogleSync(containerId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">🔄 Déversement automatique vers Google Calendar</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Les tâches de ce conteneur (avec une échéance) sont créées comme événements dans l&apos;agenda Google choisi et mises à
          jour automatiquement. Une tâche terminée reste sur l&apos;agenda avec « ✅ » devant son titre ; une tâche supprimée est
          retirée de Google Calendar.
        </p>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}

      {!googleConnected ? (
        <p className="text-sm text-[var(--text-muted)]">
          Connecte d&apos;abord ton compte Google Calendar dans <a href="/settings" className="underline">Réglages</a>.
        </p>
      ) : sync ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Synchronisé vers <span className="font-medium">{calendars?.find((c) => c.id === sync.google_calendar_id)?.summary ?? sync.google_calendar_id}</span>
            {' — '}
            <span className={sync.enabled ? 'text-fresh-high' : 'text-[var(--text-muted)]'}>{sync.enabled ? 'actif' : 'en pause'}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {sync.enabled ? (
              <button disabled={pending} className="btn btn-ghost text-xs" onClick={() => toggle(false)}>
                Mettre en pause
              </button>
            ) : (
              <button disabled={pending} className="btn btn-primary text-xs" onClick={() => toggle(true)}>
                Réactiver
              </button>
            )}
            <button disabled={pending} className="btn btn-ghost text-xs text-fresh-low" onClick={remove}>
              Retirer la synchro
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col text-xs">
            Agenda cible
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input mt-1">
              {(calendars ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          </label>
          <button disabled={pending || !selected} className="btn btn-primary" onClick={activate}>
            Activer la synchro
          </button>
        </div>
      )}
    </div>
  );
}
