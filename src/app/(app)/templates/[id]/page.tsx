import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { buildRecurrenceLabel } from '@/lib/recurrence';
import type { RecurrenceType } from '@/lib/types';
import { addTemplateItem, deleteTemplate, deleteTemplateItem, instantiateTemplate } from '../actions';

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { household } = await requireSessionAndHousehold();

  const template = await prisma.taskTemplate.findFirst({
    where: { id, OR: [{ householdId: household.id }, { householdId: null }] },
    include: { items: { orderBy: { sortOrder: 'asc' }, include: { category: true, zone: true } } },
  });
  if (!template) notFound();

  const [categories, zones, profiles] = await Promise.all([
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
  ]);

  const isEventPlanning = template.type === 'EVENT_PLANNING';
  const hasPerPersonItems = template.items.some((i) => i.perPerson);
  const isOwnTemplate = template.householdId === household.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {template.icon} {template.name}
        </h1>
        {isOwnTemplate ? (
          <form action={deleteTemplate.bind(null, template.id)}>
            <button className="text-sm text-red-600 hover:underline">Supprimer le template</button>
          </form>
        ) : (
          <span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Template système
          </span>
        )}
      </div>
      {template.description && <p className="text-slate-500">{template.description}</p>}

      <section className="card space-y-3">
        <h2 className="font-semibold">Éléments de la liste</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {template.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {item.title}
                {item.category && <span className="text-xs text-slate-400">{item.category.icon}</span>}
                {(item.zone || item.zoneName) && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                    {item.zone ? `${item.zone.icon} ${item.zone.name}` : item.zoneName}
                  </span>
                )}
                {item.recurrenceType && item.recurrenceType !== 'NONE' && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    🔁{' '}
                    {buildRecurrenceLabel(
                      item.recurrenceType as RecurrenceType,
                      item.recurrenceInterval ?? 1,
                      null,
                    )}
                  </span>
                )}
                {item.perPerson && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    👤 par personne
                  </span>
                )}
                {isEventPlanning && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                    {item.offsetDays === 0 || item.offsetDays === null
                      ? 'Jour J'
                      : item.offsetDays! > 0
                        ? `J+${item.offsetDays}`
                        : `J${item.offsetDays}`}
                  </span>
                )}
                {item.description && <span className="text-xs text-slate-400">{item.description}</span>}
              </span>
              {isOwnTemplate && (
                <form action={deleteTemplateItem.bind(null, item.id)}>
                  <button className="text-xs text-red-600 hover:underline">Retirer</button>
                </form>
              )}
            </li>
          ))}
          {template.items.length === 0 && <p className="py-2 text-sm text-slate-400">Aucun élément pour l&apos;instant.</p>}
        </ul>

        {isOwnTemplate && (
          <form action={addTemplateItem} className="grid gap-2 sm:grid-cols-6">
            <input type="hidden" name="templateId" value={template.id} />
            <input className="input sm:col-span-2" name="title" placeholder="Nouvel élément" required />
            <select className="input" name="categoryId" defaultValue="">
              <option value="">Catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <select className="input" name="zoneId" defaultValue="">
              <option value="">Zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.icon} {z.name}
                </option>
              ))}
            </select>
            {isEventPlanning && (
              <input
                className="input"
                type="text"
                inputMode="numeric"
                pattern="-?[0-9]*"
                name="offsetDays"
                placeholder="Décalage (jours), ex: -7"
                title="Nombre de jours avant (négatif) ou après (positif) la date de l'évènement"
              />
            )}
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="perPerson" /> Par personne
            </label>
            <button className="btn-secondary sm:col-span-6">Ajouter l&apos;élément</button>
          </form>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">🚀 Utiliser ce template</h2>
        <p className="text-sm text-slate-500">
          {isEventPlanning
            ? "Choisissez la date de l'évènement : chaque élément sera daté automatiquement selon son décalage (rétroplanning)."
            : template.items.some((i) => i.recurrenceType && i.recurrenceType !== 'NONE')
              ? 'Choisissez une date de départ : les tâches récurrentes seront créées dans vos tâches avec leur périodicité déjà réglée.'
              : 'Choisissez une date de référence (ex: date de départ) pour générer les tâches de cette liste.'}
        </p>
        <form action={instantiateTemplate} className="space-y-3">
          <input type="hidden" name="templateId" value={template.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nom de l&apos;évènement / occasion</label>
              <input className="input" name="eventName" required placeholder="Ex: Vacances à la mer" />
            </div>
            <div>
              <label className="label">Date de l&apos;évènement</label>
              <input className="input" type="date" name="eventDate" required />
            </div>
          </div>
          {hasPerPersonItems && (
            <div>
              <label className="label">Pour qui ? (éléments &quot;par personne&quot;)</label>
              <div className="flex flex-wrap gap-3">
                {profiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="profileId" value={p.id} /> {p.displayName}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="btn-primary w-full" disabled={template.items.length === 0}>
            Générer les tâches
          </button>
        </form>
      </section>
    </div>
  );
}
