'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyGoogleSyncToContainers, type ManageableContainer } from './google-actions';
import { listMyGoogleCalendarsForSync } from '@/app/(app)/c/[containerId]/settings/google-sync-actions';

export function GlobalSyncForm({ googleConnected, containers }: { googleConnected: boolean; containers: ManageableContainer[] }) {
  const router = useRouter();
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[] | null>(null);
  const [selectedCalendar, setSelectedCalendar] = useState('');
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!googleConnected) return;
    startTransition(async () => {
      const res = await listMyGoogleCalendarsForSync();
      if ('error' in res) {
        setError(res.error);
      } else {
        setCalendars(res.calendars);
        setSelectedCalendar(res.calendars[0]?.id ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected]);

  function toggle(id: string) {
    setSelectedContainers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    if (!selectedCalendar || selectedContainers.size === 0) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await applyGoogleSyncToContainers([...selectedContainers], selectedCalendar);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setMessage(`✅ Synchro appliquée à ${selectedContainers.size} conteneur(s).`);
      setSelectedContainers(new Set());
      router.refresh();
    });
  }

  if (!googleConnected) return null;

  const calendarLabel = (id: string | null) => calendars?.find((c) => c.id === id)?.summary ?? id ?? '';

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">🌐 Synchro Google — plusieurs conteneurs à la fois</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Applique le même agenda Google cible à plusieurs conteneurs en une fois, plutôt que d&apos;aller dans les réglages de
          chacun. Reprend exactement le même réglage que l&apos;onglet « Google Calendar » de chaque conteneur.
        </p>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      {message && <p className="text-sm text-fresh-high">{message}</p>}

      {containers.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Aucun conteneur où tu es admin ou membre pour l&apos;instant.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {containers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={selectedContainers.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="truncate text-sm">
                    {c.icon} {c.name} <span className="text-xs text-[var(--text-muted)]">· {c.householdName}</span>
                  </span>
                </label>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {c.syncedCalendarId ? `→ ${calendarLabel(c.syncedCalendarId)}${c.syncEnabled ? '' : ' (en pause)'}` : 'Aucune synchro'}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col text-xs">
              Agenda cible
              <select value={selectedCalendar} onChange={(e) => setSelectedCalendar(e.target.value)} className="input mt-1">
                {(calendars ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={pending || !selectedCalendar || selectedContainers.size === 0} className="btn btn-primary" onClick={apply}>
              Appliquer aux conteneurs sélectionnés
            </button>
          </div>
        </>
      )}
    </div>
  );
}
