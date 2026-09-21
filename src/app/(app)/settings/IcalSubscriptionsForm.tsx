'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addIcalSubscription, deleteIcalSubscription } from './actions';

export interface IcalSubscription {
  id: string;
  label: string;
  url: string;
}

export function IcalSubscriptionsForm({ subscriptions }: { subscriptions: IcalSubscription[] }) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addIcalSubscription(label, url);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setLabel('');
      setUrl('');
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteIcalSubscription(id);
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
        <h2 className="font-semibold">📅 Calendriers externes (lecture seule)</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Ajoute une ou plusieurs adresses secrètes au format iCal (Google Calendar, Outlook, Apple Calendar…) pour voir ces
          événements en superposition sur le calendrier Taskinator. Dans Google Calendar : Réglages du calendrier concerné →
          « Intégrer l'agenda » → « Adresse secrète au format iCal » (pas le lien de partage). Rien n'est écrit sur ces
          comptes, la lecture se fait toutes les 15&nbsp;minutes environ.
        </p>
      </div>

      {subscriptions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{sub.label}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{sub.url}</p>
              </div>
              <button disabled={pending} className="btn btn-ghost shrink-0 text-xs" onClick={() => remove(sub.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Nom
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Agenda perso" className="input mt-1" />
        </label>
        <label className="flex flex-1 flex-col text-xs">
          Adresse iCal (.ics)
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            className="input mt-1"
          />
        </label>
        <button disabled={pending || !url.trim()} className="btn btn-primary" onClick={add}>
          Ajouter
        </button>
      </div>
      {error && <p className="text-sm text-fresh-low">{error}</p>}
    </div>
  );
}
