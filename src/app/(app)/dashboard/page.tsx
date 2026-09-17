import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { TaskRow } from '@/components/TaskRow';

export default async function DashboardPage() {
  const { household } = await requireSessionAndHousehold();

  const [freshHousehold, overdueTasks, todayTasks, upcomingEvents, templatesCount, categories, zones, profiles] =
    await Promise.all([
      prisma.household.findUnique({ where: { id: household.id } }),
      prisma.task.findMany({
        where: { householdId: household.id, status: { not: 'DONE' }, dueDate: { lt: new Date() } },
        include: { category: true, zone: true, assignee: true },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      prisma.task.findMany({
        where: {
          householdId: household.id,
          status: { not: 'DONE' },
          dueDate: { gte: startOfToday(), lte: endOfToday() },
        },
        include: { category: true, zone: true, assignee: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.event.findMany({
        where: { householdId: household.id, eventDate: { gte: new Date() } },
        orderBy: { eventDate: 'asc' },
        take: 3,
      }),
      prisma.taskTemplate.count({ where: { householdId: household.id } }),
      prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
      prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
      prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
    ]);

  const isHouseholdPaused = Boolean(
    freshHousehold?.remindersPausedUntil && freshHousehold.remindersPausedUntil > new Date(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour 👋</h1>
        <p className="text-slate-500">Foyer {household.name}</p>
      </div>

      {isHouseholdPaused && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          🌴 Rappels en pause jusqu&apos;au {freshHousehold?.remindersPausedUntil?.toLocaleDateString('fr-FR')}
          {freshHousehold?.remindersPauseReason ? ` — ${freshHousehold.remindersPauseReason}` : ''}.{' '}
          <Link href="/settings" className="underline">
            Gérer
          </Link>
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="En retard" value={overdueTasks.length} tone="red" />
        <StatCard label="Aujourd'hui" value={todayTasks.length} tone="brand" />
        <StatCard label="Évènements à venir" value={upcomingEvents.length} tone="slate" />
      </div>

      {overdueTasks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">Tâches en retard</h2>
          <div className="space-y-1.5">
            {overdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                categories={categories}
                zones={zones}
                profiles={profiles}
                isHouseholdPaused={isHouseholdPaused}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Aujourd&apos;hui</h2>
          <Link href="/tasks" className="text-sm text-brand-700 dark:text-brand-400">
            Voir toutes les tâches →
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <p className="card text-sm text-slate-500">Rien de prévu aujourd&apos;hui. 🎉</p>
        ) : (
          <div className="space-y-1.5">
            {todayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                categories={categories}
                zones={zones}
                profiles={profiles}
                isHouseholdPaused={isHouseholdPaused}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">📅 Prochains évènements</h2>
          {upcomingEvents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Aucun évènement planifié.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <Link href={`/events/${e.id}`} className="hover:underline">
                    {e.name}
                  </Link>
                  <span className="text-slate-500">{e.eventDate.toLocaleDateString('fr-FR')}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/events" className="mt-3 inline-block text-sm text-brand-700 dark:text-brand-400">
            Gérer les évènements →
          </Link>
        </div>
        <div className="card">
          <h2 className="font-semibold">📋 Templates</h2>
          <p className="mt-2 text-sm text-slate-500">{templatesCount} liste(s) type disponible(s) pour ce foyer.</p>
          <Link href="/templates" className="mt-3 inline-block text-sm text-brand-700 dark:text-brand-400">
            Voir les templates →
          </Link>
        </div>
      </section>
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'red' | 'brand' | 'slate' }) {
  const toneClasses = {
    red: 'text-red-600 dark:text-red-400',
    brand: 'text-brand-700 dark:text-brand-400',
    slate: 'text-slate-700 dark:text-slate-300',
  }[tone];
  return (
    <div className="card text-center">
      <p className={`text-2xl font-bold ${toneClasses}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
