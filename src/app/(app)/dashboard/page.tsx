import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDashboardHouseholds, getMyUpcomingTasks, getDashboardRoomOptions } from '@/lib/data/dashboard';
import { FreshnessBar } from '@/components/FreshnessBar';
import { NewContainerForm } from './NewContainerForm';
import { DashboardFilters } from './DashboardFilters';
import { DashboardTaskItem } from './DashboardTaskItem';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ container?: string; room?: string; priority?: string; dueBefore?: string }>;
}) {
  const { container, room, priority, dueBefore } = await searchParams;
  const supabase = await createClient();
  const households = await getDashboardHouseholds(supabase);
  const containerIds = households.flatMap((h) => h.containers.map((c) => c.id));
  const [myTasks, roomOptions] = await Promise.all([
    getMyUpcomingTasks(supabase, { containerId: container, roomId: room, priority, dueBefore }),
    getDashboardRoomOptions(supabase, containerIds),
  ]);
  const containerOptions = households.flatMap((h) => h.containers.map((c) => ({ id: c.id, name: c.name })));
  const hasFilters = Boolean(container || room || priority || dueBefore);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-gradient text-2xl font-extrabold">Tableau de bord</h1>
        <div className="gradient-bar mt-2 mb-1" />
        <p className="text-sm text-[var(--text-muted)]">Vue d'ensemble de vos foyers et conteneurs.</p>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">📌 Mes prochaines tâches</h2>
        <DashboardFilters containers={containerOptions} rooms={roomOptions} />
        {myTasks.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {hasFilters ? 'Aucune tâche ne correspond à ces filtres.' : 'Rien à faire prochainement 🎉'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {myTasks.map((t) => (
              <DashboardTaskItem key={t.id} task={t} />
            ))}
          </ul>
        )}
      </div>

      {households.map((h) => (
        <div key={h.id}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{h.name}</h2>
            <NewContainerForm householdId={h.id} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {h.containers.map((c) => (
              <Link key={c.id} href={`/c/${c.id}`} className="card flex flex-col gap-3 p-4 transition hover:-translate-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: c.color + '33' }}>
                    {c.icon}
                  </span>
                  <span className="font-semibold">{c.name}</span>
                </div>
                <FreshnessBar freshness={c.freshness} />
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>
                    {c.openCount} tâche{c.openCount !== 1 ? 's' : ''} à faire
                  </span>
                  {c.overdueCount > 0 && <span className="font-semibold text-fresh-low">{c.overdueCount} en retard</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
