'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createGoogleEventManual } from '@/lib/actions/google-events';

export interface GoogleCalendarOption {
  googleCalendarId: string;
  label: string;
  color: string;
}

/** Bouton "+ Événement Google" affiché sur la vue calendrier quand au moins un agenda Google est connecté. */
export function AddGoogleEventButton({ calendars, defaultDate }: { calendars: GoogleCalendarOption[]; defaultDate?: string }) {
  const [open, setOpen] = useState(false);

  if (calendars.length === 0) return null;

  return (
    <>
      <button type="button" className="btn btn-ghost text-sm" onClick={() => setOpen(true)}>
        + Événement Google
      </button>
      {open && <AddGoogleEventModal calendars={calendars} defaultDate={defaultDate} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddGoogleEventModal({
  calendars,
  defaultDate,
  onClose,
}: {
  calendars: GoogleCalendarOption[];
  defaultDate?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [calendarId, setCalendarId] = useState(calendars[0].googleCalendarId);
  const [summary, setSummary] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    const startISO = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
    const end = new Date(startISO);
    end.setHours(end.getHours() + (allDay ? 24 : 1));
    startTransition(async () => {
      const res = await createGoogleEventManual(calendarId, {
        summary: summary.trim() || '(Sans titre)',
        startISO,
        endISO: allDay ? `${end.toISOString().slice(0, 10)}T00:00:00` : end.toISOString(),
        allDay,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card flex w-full max-w-sm flex-col gap-3 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">🗓️ Nouvel événement Google</h3>
        <label className="flex flex-col text-xs">
          Agenda
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="input mt-1">
            {calendars.map((c) => (
              <option key={c.googleCalendarId} value={c.googleCalendarId}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          Titre
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className="input mt-1" autoFocus />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Toute la journée
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col text-xs">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
          </label>
          {!allDay && (
            <label className="flex flex-1 flex-col text-xs">
              Heure
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input mt-1" />
            </label>
          )}
        </div>
        {error && <p className="text-xs text-fresh-low">{error}</p>}
        <div className="flex justify-end gap-2">
          <button disabled={pending} className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button disabled={pending || !summary.trim()} className="btn btn-primary" onClick={create}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
