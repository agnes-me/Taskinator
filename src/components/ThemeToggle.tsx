'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage indisponible (navigation privée) : le choix ne persiste pas, sans conséquence.
    }
    setDark(next);
  }

  return (
    <button onClick={toggle} className="btn btn-ghost h-9 w-9 !p-0 text-base" aria-label="Basculer le thème sombre/clair">
      {dark === null ? '·' : dark ? '☀️' : '🌙'}
    </button>
  );
}
