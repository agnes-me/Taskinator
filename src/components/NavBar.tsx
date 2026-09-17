'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { switchContainer } from '@/app/(app)/containers/actions';

const LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '🏡' },
  { href: '/tasks', label: 'Tâches', icon: '✅' },
  { href: '/events', label: 'Évènements', icon: '📅' },
  { href: '/templates', label: 'Templates', icon: '📋' },
  { href: '/settings', label: 'Réglages', icon: '⚙️' },
];

type HouseholdRef = { id: string; name: string };

export function NavBar({
  activeHousehold,
  households,
}: {
  activeHousehold: HouseholdRef;
  households: HouseholdRef[];
}) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-10 hidden border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-brand-700 dark:text-brand-400">
            🧩 Taskinator
          </Link>
          <ContainerSwitcher activeHousehold={activeHousehold} households={households} />
          <nav className="flex gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname?.startsWith(link.href)
                    ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </nav>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary text-sm">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <ContainerSwitcher activeHousehold={activeHousehold} households={households} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around overflow-x-auto border-t border-slate-200 bg-white py-1 dark:border-slate-800 dark:bg-slate-950 md:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              pathname?.startsWith(link.href)
                ? 'text-brand-700 dark:text-brand-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-lg leading-none">{link.icon}</span>
            {link.label}
          </Link>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          <span className="text-lg leading-none">🚪</span>
          Déconnexion
        </button>
      </nav>
    </>
  );
}

function ContainerSwitcher({
  activeHousehold,
  households,
}: {
  activeHousehold: HouseholdRef;
  households: HouseholdRef[];
}) {
  return (
    <form action={switchContainer} className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none">
      <span className="text-sm text-slate-400">🗂️</span>
      <select
        name="householdId"
        defaultValue={activeHousehold.id}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input min-w-0 flex-1 py-1.5 text-sm md:w-40 md:flex-none"
      >
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <Link href="/containers" className="whitespace-nowrap text-xs text-brand-700 hover:underline dark:text-brand-400">
        Gérer
      </Link>
    </form>
  );
}
