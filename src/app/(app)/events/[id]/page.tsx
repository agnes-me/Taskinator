import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { TaskCard } from '@/components/TaskCard';
import { deleteEvent } from '../actions';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { household } = await requireSessionAndHousehold();

  const event = await prisma.event.findFirst({
    where: { id, householdId: household.id },
    include: {
      template: true,
      tasks: { include: { category: true, zone: true, assignee: true }, orderBy: { dueDate: 'asc' } },
    },
  });
  if (!event) notFound();

  const freshHousehold = await prisma.household.findUnique({ where: { id: household.id } });
  const isHouseholdPaused = Boolean(
    freshHousehold?.remindersPausedUntil && freshHousehold.remindersPausedUntil > new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {event.template ? `${event.template.icon} ` : ''}
            {event.name}
          </h1>
          <p className="text-slate-500">{event.eventDate.toLocaleDateString('fr-FR', { dateStyle: 'full' })}</p>
        </div>
        <form action={deleteEvent.bind(null, event.id)}>
          <button className="text-sm text-red-600 hover:underline">Supprimer l&apos;évènement</button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {event.tasks.map((task) => (
          <TaskCard key={task.id} task={task} isHouseholdPaused={isHouseholdPaused} />
        ))}
        {event.tasks.length === 0 && <p className="card text-sm text-slate-500">Aucune tâche générée.</p>}
      </div>
    </div>
  );
}
