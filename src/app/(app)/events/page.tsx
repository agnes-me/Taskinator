import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';

export default async function EventsPage() {
  const { household } = await requireSessionAndHousehold();

  const events = await prisma.event.findMany({
    where: { householdId: household.id },
    include: { template: true, _count: { select: { tasks: true } } },
    orderBy: { eventDate: 'desc' },
  });

  const now = new Date();
  const upcoming = events.filter((e) => e.eventDate >= now);
  const past = events.filter((e) => e.eventDate < now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Évènements</h1>
        <Link href="/templates" className="btn-primary text-sm">
          + Depuis un template
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Les évènements sont générés à partir de vos templates (rétroplanning) : chaque tâche est datée
        automatiquement par rapport à la date choisie.
      </p>

      <EventList title="À venir" events={upcoming} />
      <EventList title="Passés" events={past} />
    </div>
  );
}

function EventList({
  title,
  events,
}: {
  title: string;
  events: { id: string; name: string; eventDate: Date; template: { icon: string; name: string } | null; _count: { tasks: number } }[];
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="card block hover:border-brand-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {e.template ? `${e.template.icon} ` : ''}
                {e.name}
              </span>
              <span className="text-sm text-slate-500">{e.eventDate.toLocaleDateString('fr-FR')}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{e._count.tasks} tâche(s) générée(s)</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
