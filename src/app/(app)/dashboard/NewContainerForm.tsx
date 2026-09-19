'use client';

import { useState } from 'react';
import { createContainer } from './actions';

const ICONS = ['🏠', '💼', '🏖️', '🌿', '🔑'];
const COLORS = ['#14b8a6', '#6366f1', '#f97316', '#ec4899', '#22c55e'];

export function NewContainerForm({ householdId }: { householdId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
        + Nouveau conteneur
      </button>
    );
  }
  return (
    <form action={(fd) => void createContainer(householdId, fd)} className="card flex flex-wrap items-end gap-2 p-3">
      <label className="text-sm">
        Nom
        <input name="name" required placeholder="Pro" className="input mt-1" />
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
        Couleur
        <select name="color" className="input mt-1">
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-primary">
        Créer
      </button>
    </form>
  );
}
