import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContainerContext } from '@/lib/data/nav';

export default async function ContainerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ containerId: string }>;
}) {
  const { containerId } = await params;
  const { container, role } = await getContainerContext(containerId);

  if (!container || !role) notFound();

  const tabs = [
    { href: `/c/${containerId}`, label: '🧹 Pièces' },
    { href: `/c/${containerId}/tasks`, label: '✅ Tâches' },
    { href: `/c/${containerId}/events`, label: '🎉 Événements' },
    { href: `/c/${containerId}/members`, label: '👥 Membres' },
  ];

  return (
    <div style={{ ['--container-color' as string]: container.color }}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: container.color + '33' }}
          >
            {container.icon}
          </span>
          <div>
            <h1 className="text-xl font-bold">{container.name}</h1>
            {container.paused_until && new Date(container.paused_until) > new Date() && (
              <p className="text-xs font-medium text-fresh-mid">⏸ En pause jusqu'au {new Date(container.paused_until).toLocaleDateString('fr-FR')}</p>
            )}
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-muted)]"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
