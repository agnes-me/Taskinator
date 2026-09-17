type IcsTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: Date;
};

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Génère un flux ICS (calendrier) abonnable depuis Google Calendar / Apple Calendar / Outlook. */
export function buildIcsFeed(householdName: string, tasks: IcsTask[]): string {
  const now = formatIcsDate(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Taskinator//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(`Taskinator - ${householdName}`)}`,
  ];

  for (const task of tasks) {
    const dt = formatIcsDate(task.dueDate);
    const eventLines = [
      'BEGIN:VEVENT',
      `UID:taskinator-${task.id}@taskinator.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${dt}`,
      `SUMMARY:${escapeIcsText(task.title)}`,
      task.description ? `DESCRIPTION:${escapeIcsText(task.description)}` : null,
      'END:VEVENT',
    ].filter((line): line is string => line !== null);
    lines.push(...eventLines);
  }

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

/** Génère un lien "Ajouter à Google Calendar" pour une tâche ponctuelle. */
export function buildGoogleCalendarLink(task: { title: string; description?: string | null; dueDate: Date }): string {
  const start = formatIcsDate(task.dueDate);
  const endDate = new Date(task.dueDate.getTime() + 30 * 60 * 1000);
  const end = formatIcsDate(endDate);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${start}/${end}`,
    details: task.description ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
