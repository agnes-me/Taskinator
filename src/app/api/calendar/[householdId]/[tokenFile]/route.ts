import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildIcsFeed } from '@/lib/ics';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ householdId: string; tokenFile: string }> },
) {
  const { householdId, tokenFile } = await params;
  const token = tokenFile.replace(/\.ics$/i, '');

  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household || household.icsToken !== token) {
    return new NextResponse('Not found', { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { householdId: household.id, dueDate: { not: null }, status: { not: 'DONE' } },
    select: { id: true, title: true, description: true, dueDate: true },
  });

  const ics = buildIcsFeed(
    household.name,
    tasks.map((t) => ({ ...t, dueDate: t.dueDate! })),
  );

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="taskinator.ics"',
    },
  });
}
