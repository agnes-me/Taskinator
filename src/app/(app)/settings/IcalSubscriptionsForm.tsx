'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addIcalSubscription, deleteIcalSubscription, updateIcalSubscription } from './actions';

export interface IcalSubscription {
  id: string;
  label: string;
  url: string;
  color: string;
  visible: boolean;
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
          comptes, la lecture se fait toutes les 15&nbsp;minutes environ. Décoche un calendrier pour le masquer sans le
          supprimer.
        </p>
      </div>

      {subscriptions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <SubscriptionRow key={sub.id} subscription={sub} onRemove={() => remove(sub.id)} onChanged={() => router.refresh()} />
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

function SubscriptionRow({
  subscription,
  onRemove,
  onChanged,
}: {
  subscription: IcalSubscription;
  onRemove: () => void;
  onChanged: () => void;
}) {
  const [color, setColor] = useState(subscription.color);
  const [visible, setVisible] = useState(subscription.visible);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(patch: { color?: string; visible?: boolean }) {
    setError(null);
    startTransition(async () => {
      const res = await updateIcalSubscription(subscription.id, patch);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onChanged();
    });
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-[var(--border)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0">
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
            aria-label={`Couleur de ${subscription.label}`}
          />
          <span className="min-w-0">
            <p className="truncate text-sm font-medium">{subscription.label}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{subscription.url}</p>
          </span>
        </label>
        <button disabled={pending} className="btn btn-ghost shrink-0 text-xs" onClick={onRemove}>
          Retirer
        </button>
      </div>
      {error && <p className="text-xs text-fresh-low">{error}</p>}
    </li>
  );
}
