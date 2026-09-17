import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { createTemplate } from './actions';

const TYPE_LABELS: Record<string, string> = {
  CHECKLIST: 'Liste simple',
  EVENT_PLANNING: 'Rétroplanning',
};

export default async function TemplatesPage() {
  const { household } = await requireSessionAndHousehold();

  const templates = await prisma.taskTemplate.findMany({
    where: { householdId: household.id },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Templates</h1>
      <p className="text-sm text-slate-500">
        Créez des listes types réutilisables (valises, courses, préparation d&apos;un évènement...). Pour les
        templates de type <strong>rétroplanning</strong>, chaque élément peut avoir un décalage de jours par
        rapport à la date de l&apos;évènement.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/templates/${t.id}`} className="card block hover:border-brand-400">
            <div className="flex items-center justify-between">
              <span className="text-lg">
                {t.icon} {t.name}
              </span>
              <span className="text-xs text-slate-400">{TYPE_LABELS[t.type]}</span>
            </div>
            {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
            <p className="mt-2 text-xs text-slate-400">{t._count.items} élément(s)</p>
          </Link>
        ))}
      </div>

      <details className="card">
        <summary className="cursor-pointer font-medium">➕ Nouveau template</summary>
        <form action={createTemplate} className="mt-3 space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input" name="name" required placeholder="Ex: Valise ski" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" name="description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Icône</label>
              <input className="input" name="icon" placeholder="📋" maxLength={4} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" name="type" defaultValue="CHECKLIST">
                <option value="CHECKLIST">Liste simple (valise, courses...)</option>
                <option value="EVENT_PLANNING">Rétroplanning (basé sur une date d&apos;évènement)</option>
              </select>
            </div>
          </div>
          <button className="btn-primary w-full">Créer le template</button>
        </form>
      </details>
    </div>
  );
}
