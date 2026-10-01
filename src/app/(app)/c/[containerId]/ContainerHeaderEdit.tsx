'use client';

import { useState, useTransition } from 'react';
import { updateContainer } from './actions';

const ICONS = ['🏠', '💼', '🏖️', '🌿', '🔑'];
const COLORS = ['#14b8a6', '#6366f1', '#f97316', '#ec4899', '#22c55e'];

export function ContainerHeaderEdit({
  containerId,
  name,
  icon,
  color,
  pausedUntil,
}: {
  containerId: string;
  name: string;
  icon: string;
  color: string;
  pausedUntil: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        action={(fd) =>
          startTransition(async () => {
            const res = await updateContainer(containerId, fd);
            if (res?.error) setError(res.error);
            else {
              setEditing(false);
              setError(null);
            }
          })
        }
      >
        <label className="text-sm">
          Icône
          <select name="icon" defaultValue={icon} className="input mt-1">
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Nom
          <input name="name" required defaultValue={name} className="input mt-1" />
        </label>
        <label className="text-sm">
          Couleur
          <select name="color" defaultValue={color} className="input mt-1">
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary !py-1.5 text-sm">
          Enregistrer
        </button>
        <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => setEditing(false)}>
          Annuler
        </button>
        {error && <p className="w-full text-sm text-fresh-low">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: color + '33' }}>
        {icon}
      </span>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          {name}
          <button
            className="text-sm font-normal text-[var(--text-muted)] hover:underline"
            onClick={() => setEditing(true)}
            aria-label="Modifier le conteneur"
          >
            ✏️
          </button>
        </h1>
        {pausedUntil && new Date(pausedUntil) > new Date() && (
          <p className="text-xs font-medium text-fresh-mid">⏸ En pause jusqu'au {new Date(pausedUntil).toLocaleDateString('fr-FR')}</p>
        )}
      </div>
    </div>
  );
}
