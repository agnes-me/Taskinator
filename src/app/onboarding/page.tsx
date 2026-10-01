'use client';

import { useActionState } from 'react';
import { createFirstHousehold } from './actions';

const ICONS = ['🏠', '💼', '🏖️', '👨‍👩‍👧‍👦', '🌿', '🔑'];
const COLORS = ['#14b8a6', '#6366f1', '#f97316', '#ec4899', '#22c55e', '#0ea5e9'];

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(createFirstHousehold, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl">✨</div>
          <h1 className="mt-2 text-xl font-bold">Bienvenue !</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Créons votre premier foyer et votre premier conteneur (ex : « Perso », « Maison principale »).
          </p>
        </div>
        <form action={formAction} className="flex flex-col gap-4">
          <label className="text-sm font-medium">
            Nom du foyer
            <input name="householdName" required placeholder="Notre famille" className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium">
            Nom du premier conteneur
            <input name="containerName" required placeholder="Maison principale" className="input mt-1 w-full" />
          </label>
          <div>
            <span className="text-sm font-medium">Icône</span>
            <div className="mt-1 flex gap-2">
              {ICONS.map((icon, i) => (
                <label key={icon} className="cursor-pointer">
                  <input type="radio" name="containerIcon" value={icon} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-lg peer-checked:border-brand-500 peer-checked:bg-brand-50">
                    {icon}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium">Couleur</span>
            <div className="mt-1 flex gap-2">
              {COLORS.map((color, i) => (
                <label key={color} className="cursor-pointer">
                  <input type="radio" name="containerColor" value={color} defaultChecked={i === 0} className="peer sr-only" />
                  <span
                    className="block h-8 w-8 rounded-full ring-offset-2 peer-checked:ring-2"
                    style={{ background: color, ['--tw-ring-color' as string]: color }}
                  />
                </label>
              ))}
            </div>
          </div>
          {state.error && <p className="text-sm text-fresh-low">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-60">
            {pending ? 'Création…' : 'Commencer'}
          </button>
        </form>
      </div>
    </div>
  );
}
