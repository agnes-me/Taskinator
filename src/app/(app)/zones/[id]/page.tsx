import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { TaskRow } from '@/components/TaskRow';
import { buildRecurrenceLabel } from '@/lib/recurrence';
import type { RecurrenceType } from '@/lib/types';
import { applyZoneTemplate } from '../actions';

export default async function ZoneDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { id } = await params;
  const { templateId: preselectedTemplateId } = await searchParams;
  const { household } = await requireSessionAndHousehold();

  const zone = await prisma.zone.findFirst({ where: { id, householdId: household.id } });
  if (!zone) notFound();

  const [tasks, categories, zones, profiles, zoneTemplates, freshHousehold] = await Promise.all([
    prisma.task.findMany({
      where: { householdId: household.id, zoneId: zone.id, status: { not: 'DONE' } },
      include: { category: true, zone: true, assignee: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
    prisma.taskTemplate.findMany({
      where: { householdId: null, type: 'ZONE_CHECKLIST' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.household.findUnique({ where: { id: household.id } }),
  ]);

  const isHouseholdPaused = Boolean(
    freshHousehold?.remindersPausedUntil && freshHousehold.remindersPausedUntil > new Date(),
  );

  const normalizedZoneName = zone.name.trim().toLowerCase();
  const bestMatch =
    zoneTemplates.find((t) => t.name.toLowerCase() === normalizedZoneName) ??
    zoneTemplates.find(
      (t) => normalizedZoneName.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(normalizedZoneName),
    );
  const selectedTemplateId = preselectedTemplateId ?? bestMatch?.id ?? zoneTemplates[0]?.id ?? '';
  const selectedTemplate = zoneTemplates.find((t) => t.id === selectedTemplateId) ?? null;
  const existingTitles = new Set(tasks.map((t) => t.title));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {zone.icon} {zone.name}
        </h1>
        <Link href="/settings" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
          ← Retour aux zones
        </Link>
      </div>

      {zoneTemplates.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">📋 Tâches types pour cette zone</h2>
          <p className="text-sm text-slate-500">
            Choisissez un template et cochez les tâches à ajouter : elles sont créées
            directement avec leur périodicité, pas besoin de nom d&apos;évènement ni de date.
          </p>

          <form method="get" className="flex flex-wrap items-end gap-2">
            <select className="input w-auto" name="templateId" defaultValue={selectedTemplateId}>
              {zoneTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name} ({t.items.length})
                </option>
              ))}
            </select>
            <button className="btn-secondary text-sm">Changer de template</button>
          </form>

          {selectedTemplate && (
            <form action={applyZoneTemplate} className="space-y-2">
              <input type="hidden" name="zoneId" value={zone.id} />
              <input type="hidden" name="templateId" value={selectedTemplate.id} />
              <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                {selectedTemplate.items.map((item) => {
                  const alreadyExists = existingTitles.has(item.title);
                  return (
                    <li key={item.id} className="flex items-start gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        name="itemId"
                        value={item.id}
                        defaultChecked={!alreadyExists}
                        className="mt-0.5"
                      />
                      <span className={alreadyExists ? 'text-slate-400' : ''}>
                        {item.title}
                        {item.recurrenceType && item.recurrenceType !== 'NONE' && (
                          <span className="ml-1.5 text-xs text-brand-700 dark:text-brand-400">
                            🔁 {buildRecurrenceLabel(item.recurrenceType as RecurrenceType, item.recurrenceInterval ?? 1, null)}
                          </span>
                        )}
                        {alreadyExists && <span className="ml-1.5 text-xs italic">(déjà présente)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button className="btn-primary w-full">Ajouter les tâches cochées</button>
            </form>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tâches de cette zone ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <p className="card text-sm text-slate-500">Aucune tâche pour l&apos;instant.</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
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
    </div>
  );
}
