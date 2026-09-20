export interface GoogleEvent {
  id: string;
  summary: string;
  date: string; // yyyy-mm-dd, for grouping onto the calendar grid
  startAt: string | null; // full ISO datetime when timed, null when all-day
}

// Déplie les lignes RFC 5545 : une ligne de continuation commence par une espace/tabulation.
function unfoldICS(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseICSDate(value: string, allDay: boolean): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (allDay || !h) return new Date(Number(y), Number(mo) - 1, Number(d));
  if (z) return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  // Sans indication de fuseau explicite (TZID ou Z), on traite l'heure comme locale.
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ne gère que les événements ponctuels (pas d'expansion des RRULE récurrentes) : suffisant
// pour repérer la plupart des collisions sans risquer une expansion de récurrence incorrecte.
export function parseICSEvents(text: string): GoogleEvent[] {
  const lines = unfoldICS(text);
  const events: GoogleEvent[] = [];
  let inEvent = false;
  let summary = '';
  let dtstart = '';
  let allDay = false;
  let hasRRule = false;
  let uid = '';
  let counter = 0;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      summary = '';
      dtstart = '';
      allDay = false;
      hasRRule = false;
      uid = '';
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (inEvent && dtstart && !hasRRule) {
        const date = parseICSDate(dtstart, allDay);
        if (date) {
          events.push({
            id: uid || `google-${counter++}`,
            summary: summary || '(Sans titre)',
            date: toISO(date),
            startAt: allDay ? null : date.toISOString(),
          });
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('SUMMARY')) {
      const idx = line.indexOf(':');
      if (idx >= 0) summary = line.slice(idx + 1).replace(/\\,/g, ',').replace(/\\n/gi, ' ');
    } else if (line.startsWith('DTSTART')) {
      allDay = line.startsWith('DTSTART;VALUE=DATE:') || (line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME'));
      const idx = line.indexOf(':');
      if (idx >= 0) dtstart = line.slice(idx + 1);
    } else if (line.startsWith('RRULE')) {
      hasRRule = true;
    } else if (line.startsWith('UID')) {
      const idx = line.indexOf(':');
      if (idx >= 0) uid = line.slice(idx + 1);
    }
  }

  return events;
}

export async function fetchGoogleEvents(url: string): Promise<GoogleEvent[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseICSEvents(text);
  } catch {
    return [];
  }
}
