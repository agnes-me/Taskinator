'use client';

import { useState, useTransition } from 'react';
import { updateThemeGradient } from './actions';

const DEFAULT_GRADIENT = ['#14b8a6', '#6366f1'];
const SUGGESTIONS: string[][] = [
  ['#14b8a6', '#6366f1'],
  ['#f97316', '#ec4899'],
  ['#22c55e', '#0ea5e9'],
  ['#a855f7', '#ec4899'],
  ['#f59e0b', '#ef4444'],
  ['#0ea5e9', '#14b8a6'],
];

export function ThemeGradientForm({ initialColors }: { initialColors: string[] }) {
  const [colors, setColors] = useState<string[]>(initialColors.length >= 2 ? initialColors : DEFAULT_GRADIENT);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const gradient = `linear-gradient(135deg, ${colors.join(', ')})`;

  function updateColor(i: number, value: string) {
    setColors((prev) => prev.map((c, idx) => (idx === i ? value : c)));
    setSaved(false);
  }

  function addColor() {
    if (colors.length >= 5) return;
    setColors((prev) => [...prev, '#94a3b8']);
    setSaved(false);
  }

  function removeColor(i: number) {
    if (colors.length <= 2) return;
    setColors((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      const res = await updateThemeGradient(colors);
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setSaved(true);
      }
    });
  }

  return (
    <div className="card flex flex-col gap-5 p-5">
      <div>
        <h2 className="font-semibold">Dégradé personnel</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Choisis 2 à 5 couleurs : elles habillent les boutons principaux et l'en-tête de l'appli, pour toi uniquement. En mode
          sombre, le même dégradé est automatiquement assombri — pas besoin de le régler deux fois.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={c}
              onChange={(e) => updateColor(i, e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-0.5"
              aria-label={`Couleur ${i + 1}`}
            />
            {colors.length > 2 && (
              <button className="text-xs text-[var(--text-muted)] hover:text-fresh-low" onClick={() => removeColor(i)} aria-label="Retirer cette couleur">
                ✕
              </button>
            )}
          </div>
        ))}
        {colors.length < 5 && (
          <button className="btn btn-ghost !px-3 !py-2 text-sm" onClick={addColor}>
            + couleur
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">Aperçu — mode clair</span>
        <div className="h-12 rounded-xl" style={{ background: gradient }} />
        <span className="mt-2 text-xs font-medium text-[var(--text-muted)]">Aperçu — mode sombre</span>
        <div className="h-12 rounded-xl" style={{ background: gradient, filter: 'brightness(0.78) saturate(1.08)' }} />
      </div>

      <div>
        <span className="text-xs font-medium text-[var(--text-muted)]">Suggestions</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((sugg, i) => (
            <button
              key={i}
              className="h-8 w-16 rounded-lg border border-[var(--border)]"
              style={{ background: `linear-gradient(135deg, ${sugg.join(', ')})` }}
              onClick={() => {
                setColors(sugg);
                setSaved(false);
              }}
              aria-label={`Utiliser le dégradé ${sugg.join(' vers ')}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-fresh-low">{error}</p>}
      {saved && !error && <p className="text-sm text-fresh-high">Enregistré !</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary" onClick={save}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setColors(DEFAULT_GRADIENT);
            setSaved(false);
          }}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
