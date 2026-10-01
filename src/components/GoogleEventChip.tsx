'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GoogleEvent } from '@/lib/google-ical';
import { deleteGoogleEvent, updateGoogleEvent } from '@/lib/actions/google-events';

function googleEventStyle(color?: string): React.CSSProperties {
  const hex = color || '#0ea5e9';
  return { backgroundColor: `${hex}1A`, color: hex };
}

/** Puce d'événement Google sur le calendrier — éditable/supprimable si issue d'un agenda OAuth, simple affichage sinon (iCal). */
export function GoogleEventChip({ event, className = 'truncate rounded px-1 py-0.5' }: { event: GoogleEvent; className?: string }) {
  const [editing, setEditing] = useState(false);
  const title = event.calendarLabel ? `${event.summary} — ${event.calendarLabel}` : event.summary;

  if (!event.editable) {
    return (
      <span className={className} style={googleEventStyle(event.calendarColor)} title={title}>
        🗓️ {event.summary}
      </span>
    );
  }

  return (
    <>
      <button type="button" className={`${className} text-left`} style={googleEventStyle(event.calendarColor)} title={title} onClick={() => setEditing(true)}>
        🗓️ {event.summary}
      </button>
      {editing && <GoogleEventEditModal event={event} onClose={() => setEditing(false)} />}
    </>
  );
}

function GoogleEventEditModal({ event, onClose }: { event: GoogleEvent; onClose: () => void }) {
  const router = useRouter();
  const [summary, setSummary] = useState(event.summary);
  const [allDay, setAllDay] = useState(!event.startAt);
  const initialDate = event.startAt ? event.startAt.slice(0, 10) : event.date;
  const initialTime = event.startAt ? event.startAt.slice(11, 16) : '09:00';
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!event.googleCalendarId || !event.googleEventId) return;
    setError(null);
    const startISO = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
    const endDate = new Date(startISO);
    endDate.setHours(endDate.getHours() + (allDay ? 24 : 1));
    startTransition(async () => {
      const res = await updateGoogleEvent(event.googleCalendarId!, event.googleEventId!, {
        summary: summary.trim() || '(Sans titre)',
        startISO,
        endISO: allDay ? endDate.toISOString().slice(0, 10) + 'T00:00:00' : endDate.toISOString(),
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

  function remove() {
    if (!event.googleCalendarId || !event.googleEventId) return;
    if (!window.confirm(`Supprimer « ${event.summary} » de Google Calendar ?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteGoogleEvent(event.googleCalendarId!, event.googleEventId!);
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
        <h3 className="font-semibold">🗓️ Modifier l&apos;événement Google</h3>
        <label className="flex flex-col text-xs">
          Titre
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className="input mt-1" />
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
        <div className="flex items-center justify-between gap-2">
          <button disabled={pending} className="btn btn-ghost text-xs text-fresh-low" onClick={remove}>
            Supprimer
          </button>
          <div className="flex gap-2">
            <button disabled={pending} className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button disabled={pending || !summary.trim()} className="btn btn-primary" onClick={save}>
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
