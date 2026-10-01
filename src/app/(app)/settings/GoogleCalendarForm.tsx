'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addGoogleCalendar, disconnectGoogle, listAddableGoogleCalendars, removeGoogleCalendar, updateGoogleCalendar } from './google-actions';

export interface GoogleCalendarEntry {
  id: string;
  google_calendar_id: string;
  label: string;
  color: string;
  visible: boolean;
}

export function GoogleCalendarForm({
  connected,
  calendars,
  bannerConnected,
  bannerError,
}: {
  connected: boolean;
  calendars: GoogleCalendarEntry[];
  bannerConnected: boolean;
  bannerError: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(bannerError);
  const [addable, setAddable] = useState<{ id: string; summary: string }[] | null>(null);
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!connected) return;
    startTransition(async () => {
      const res = await listAddableGoogleCalendars();
      if ('error' in res) {
        setError(res.error);
      } else {
        setAddable(res.calendars);
        setSelectedToAdd(res.calendars[0]?.id ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, calendars.length]);

  function addCalendar() {
    const cal = addable?.find((c) => c.id === selectedToAdd);
    if (!cal) return;
    setError(null);
    startTransition(async () => {
      const res = await addGoogleCalendar(cal.id, cal.summary);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function disconnect() {
    if (!window.confirm('Déconnecter Google Calendar ? Les agendas ajoutés ici ne seront plus affichés ni synchronisés.')) return;
    setError(null);
    startTransition(async () => {
      const res = await disconnectGoogle();
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeGoogleCalendar(id);
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
        <h2 className="font-semibold">🔗 Google Calendar (lecture et modification)</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Avec ton consentement, Taskinator peut afficher tes agendas Google directement (sans les 15&nbsp;minutes de délai des
          calendriers en lecture seule ci-dessous) et te laisser créer/modifier/supprimer leurs événements depuis l&apos;appli.
        </p>
      </div>

      {bannerConnected && <p className="text-sm text-fresh-high">✅ Google Calendar connecté.</p>}
      {error && <p className="text-sm text-fresh-low">{error}</p>}

      {!connected ? (
        <a href="/api/google/connect" className="btn btn-primary self-start">
          Connecter Google Calendar
        </a>
      ) : (
        <>
          {calendars.length > 0 && (
            <ul className="flex flex-col gap-2">
              {calendars.map((cal) => (
                <GoogleCalendarRow key={cal.id} calendar={cal} onRemove={() => remove(cal.id)} onSaved={() => router.refresh()} />
              ))}
            </ul>
          )}

          {addable && addable.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-1 flex-col text-xs">
                Ajouter un agenda
                <select value={selectedToAdd} onChange={(e) => setSelectedToAdd(e.target.value)} className="input mt-1">
                  {addable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={pending || !selectedToAdd} className="btn btn-primary" onClick={addCalendar}>
                Ajouter
              </button>
            </div>
          )}

          <button disabled={pending} className="btn btn-ghost self-start text-xs text-fresh-low" onClick={disconnect}>
            Déconnecter Google Calendar
          </button>
        </>
      )}
    </div>
  );
}

function GoogleCalendarRow({
  calendar,
  onRemove,
  onSaved,
}: {
  calendar: GoogleCalendarEntry;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const [color, setColor] = useState(calendar.color);
  const [visible, setVisible] = useState(calendar.visible);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(patch: { color?: string; visible?: boolean }) {
    setError(null);
    startTransition(async () => {
      const res = await updateGoogleCalendar(calendar.id, patch);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-[var(--border)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <input
            type="checkbox"
            checked={visible}
            disabled={pending}
            onChange={(e) => {
              setVisible(e.target.checked);
              save({ visible: e.target.checked });
            }}
          />
          <input
            type="color"
            value={color}
            disabled={pending}
            onChange={(e) => {
              setColor(e.target.value);
              save({ color: e.target.value });
            }}
            className="h-6 w-6 shrink-0 cursor-pointer rounded border border-[var(--border)]"
            aria-label={`Couleur de ${calendar.label}`}
          />
          <span className="truncate text-sm font-medium">{calendar.label}</span>
        </label>
        <button disabled={pending} className="btn btn-ghost shrink-0 text-xs" onClick={onRemove}>
          Retirer
        </button>
      </div>
      {error && <p className="text-xs text-fresh-low">{error}</p>}
    </li>
  );
}
