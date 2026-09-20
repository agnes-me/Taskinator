'use client';

import { useState, useTransition } from 'react';
import { updateGoogleIcalUrl } from './actions';

export function GoogleCalendarForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateGoogleIcalUrl(url);
      if (res?.error) {
        setError(res.error);
        setSaved(false);
      } else {
        setError(null);
        setSaved(true);
      }
    });
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">📅 Google Calendar (lecture seule)</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Colle ici l'adresse secrète au format iCal de ton Google Calendar pour voir tes événements Google en superposition sur le
          calendrier Taskinator, et repérer les collisions. Dans Google Calendar : Réglages du calendrier concerné → « Intégrer
          l'agenda » → « Adresse secrète au format iCal ». Rien n'est écrit sur ton compte Google, la lecture se fait toutes les
          15&nbsp;minutes environ.
        </p>
      </div>
      <input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setSaved(false);
        }}
        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
        className="input"
      />
      {error && <p className="text-sm text-fresh-low">{error}</p>}
      {saved && !error && <p className="text-sm text-brand-600">Enregistré !</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary self-start" onClick={save}>
          Enregistrer
        </button>
        {url && (
          <button
            disabled={pending}
            className="btn btn-ghost self-start"
            onClick={() => {
              setUrl('');
              startTransition(async () => {
                await updateGoogleIcalUrl('');
                setSaved(true);
              });
            }}
          >
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}
