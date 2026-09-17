import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { TaskForm } from '@/components/TaskForm';
import { TaskCard } from '@/components/TaskCard';

type TaskWithRelations = Prisma.TaskGetPayload<{ include: { category: true; zone: true; assignee: true } }>;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; zoneId?: string }>;
}) {
  const params = await searchParams;
  const { household } = await requireSessionAndHousehold();

  const [categories, zones, profiles, freshHousehold] = await Promise.all([
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
    prisma.household.findUnique({ where: { id: household.id } }),
  ]);

  const isHouseholdPaused = Boolean(
    freshHousehold?.remindersPausedUntil && freshHousehold.remindersPausedUntil > new Date(),
  );

  const where = {
    householdId: household.id,
    status: { not: 'DONE' as const },
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.zoneId ? { zoneId: params.zoneId } : {}),
  };

  const tasks = await prisma.task.findMany({
    where,
    include: { category: true, zone: true, assignee: true },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const now = new Date();
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now);
  const upcoming = tasks.filter((t) => t.dueDate && t.dueDate >= now);
  const noDueDate = tasks.filter((t) => !t.dueDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tâches</h1>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-medium">➕ Nouvelle tâche</summary>
        <div className="mt-3">
          <TaskForm categories={categories} zones={zones} profiles={profiles} />
        </div>
      </details>

      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <select className="input w-auto" name="categoryId" defaultValue={params.categoryId ?? ''}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" name="zoneId" defaultValue={params.zoneId ?? ''}>
          <option value="">Toutes zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.icon} {z.name}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {isHouseholdPaused && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          🌴 Les rappels sont en pause pour tout le foyer (voir Réglages).
        </p>
      )}

      <Section title={`En retard (${overdue.length})`} tasks={overdue} isHouseholdPaused={isHouseholdPaused} />
      <Section title={`À venir (${upcoming.length})`} tasks={upcoming} isHouseholdPaused={isHouseholdPaused} />
      <Section title={`Sans échéance (${noDueDate.length})`} tasks={noDueDate} isHouseholdPaused={isHouseholdPaused} />
    </div>
  );
}

function Section({
  title,
  tasks,
  isHouseholdPaused,
}: {
  title: string;
  tasks: TaskWithRelations[];
  isHouseholdPaused: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} isHouseholdPaused={isHouseholdPaused} />
        ))}
      </div>
    </section>
  );
}
