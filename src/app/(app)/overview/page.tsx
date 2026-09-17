import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { getUserHouseholds } from '@/lib/current-household';
import { TaskRow } from '@/components/TaskRow';
import { TaskForm } from '@/components/TaskForm';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Vue agrégée : un aperçu des tâches en retard / du jour dans TOUS les conteneurs de
 * l'utilisateur, sans avoir à basculer de l'un à l'autre. */
export default async function OverviewPage() {
  const { userId, household: activeHousehold } = await requireSessionAndHousehold();
  const memberships = await getUserHouseholds(userId);

  const sections = await Promise.all(
    memberships.map(async ({ household }) => {
      const now = new Date();
      const [overdueTasks, todayTasks, categories, zones, profiles] = await Promise.all([
        prisma.task.findMany({
          where: { householdId: household.id, status: { not: 'DONE' }, dueDate: { lt: now } },
          include: { category: true, zone: true, assignee: true },
          orderBy: { dueDate: 'asc' },
          take: 8,
        }),
        prisma.task.findMany({
          where: { householdId: household.id, status: { not: 'DONE' }, dueDate: { gte: startOfToday() } },
          include: { category: true, zone: true, assignee: true },
          orderBy: { dueDate: 'asc' },
          take: 8,
        }),
        prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
        prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
        prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
      ]);

      const isHouseholdPaused = Boolean(household.remindersPausedUntil && household.remindersPausedUntil > now);

      return { household, overdueTasks, todayTasks, categories, zones, profiles, isHouseholdPaused };
    }),
  );

  const totalOverdue = sections.reduce((sum, s) => sum + s.overdueTasks.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vue globale</h1>
        <p className="text-sm text-slate-500">
          Toutes les tâches en retard ou du jour, tous conteneurs confondus ({sections.length} conteneur(s)
          {totalOverdue > 0 ? `, ${totalOverdue} en retard au total` : ''}).
        </p>
      </div>

      {sections.map(({ household, overdueTasks, todayTasks, categories, zones, profiles, isHouseholdPaused }) => (
        <section key={household.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {household.isPersonal ? '🔒' : '🗂️'} {household.name}
              {household.id === activeHousehold.id && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-normal text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  Actif
                </span>
              )}
            </h2>
            <Link href="/containers" className="text-xs text-brand-700 hover:underline dark:text-brand-400">
              Gérer
            </Link>
          </div>

          {overdueTasks.length === 0 && todayTasks.length === 0 ? (
            <p className="card text-sm text-slate-500">Rien en retard ni prévu aujourd&apos;hui. 🎉</p>
          ) : (
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

          <details>
            <summary className="cursor-pointer text-xs text-brand-700 dark:text-brand-400">
              ➕ Ajouter une tâche dans {household.name}
            </summary>
            <div className="mt-2">
              <TaskForm categories={categories} zones={zones} profiles={profiles} householdId={household.id} />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
