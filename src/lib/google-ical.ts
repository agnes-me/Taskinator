export interface GoogleEvent {
  id: string;
  summary: string;
  date: string; // yyyy-mm-dd, for grouping onto the calendar grid
  startAt: string | null; // full ISO datetime when timed, null when all-day
  calendarLabel?: string; // nom de l'abonnement iCal d'origine, quand plusieurs sont fusionnés
}

export interface GoogleEventsResult {
  events: GoogleEvent[];
  error: string | null;
}

// Fenêtre d'expansion des événements récurrents : au-delà, on ne les développe plus (évite une
// boucle infinie/coûteuse sur un RRULE sans COUNT ni UNTIL, tout en couvrant largement ce que le
// calendrier Taskinator permet de naviguer).
const EXPAND_MONTHS_BACK = 6;
const EXPAND_MONTHS_FORWARD = 18;
const MAX_OCCURRENCES_PER_EVENT = 500;

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

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  byDay?: string[];
}

const WEEKDAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRRule(value: string): RRule | null {
  const map = new Map<string, string>();
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) map.set(k.toUpperCase(), v);
  }
  const freq = map.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;

  const byDay = map.get('BYDAY')?.split(',');
  // BYMONTHDAY/BYSETPOS ("2e mardi du mois", etc.) ne sont pas gérés : on préfère ignorer
  // l'événement plutôt que d'afficher une date fausse.
  if ((freq === 'MONTHLY' || freq === 'YEARLY') && byDay?.length) return null;

  const untilRaw = map.get('UNTIL');
  return {
    freq,
    interval: Math.max(1, Number(map.get('INTERVAL') ?? '1') || 1),
    count: map.get('COUNT') ? Number(map.get('COUNT')) : undefined,
    until: untilRaw ? (parseICSDate(untilRaw, !untilRaw.includes('T')) ?? undefined) : undefined,
    byDay: freq === 'WEEKLY' ? byDay : undefined,
  };
}

function expandRecurring(startDate: Date, rule: RRule): Date[] {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - EXPAND_MONTHS_BACK, now.getDate());
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + EXPAND_MONTHS_FORWARD, now.getDate());
  const hardEnd = rule.until && rule.until < windowEnd ? rule.until : windowEnd;
  const occurrences: Date[] = [];

  if (rule.freq === 'WEEKLY' && rule.byDay?.length) {
    const days = rule.byDay.map((d) => WEEKDAY_INDEX[d]).filter((d) => d !== undefined);
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let weekIndex = 0;
    let total = 0;
    while (weekStart <= hardEnd && total < MAX_OCCURRENCES_PER_EVENT) {
      if (weekIndex % rule.interval === 0) {
        for (const dow of days) {
          const occ = new Date(weekStart);
          occ.setDate(occ.getDate() + dow);
          occ.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
          if (occ >= startDate && occ >= windowStart && occ <= hardEnd) {
            occurrences.push(occ);
            total++;
            if (rule.count && total >= rule.count) return occurrences;
          }
        }
      }
      weekStart.setDate(weekStart.getDate() + 7);
      weekIndex++;
    }
    return occurrences;
  }

  const current = new Date(startDate);
  let total = 0;
  while (current <= hardEnd && total < MAX_OCCURRENCES_PER_EVENT) {
    if (current >= windowStart) {
      occurrences.push(new Date(current));
      total++;
      if (rule.count && total >= rule.count) break;
    }
    if (rule.freq === 'DAILY') current.setDate(current.getDate() + rule.interval);
    else if (rule.freq === 'WEEKLY') current.setDate(current.getDate() + 7 * rule.interval);
    else if (rule.freq === 'MONTHLY') current.setMonth(current.getMonth() + rule.interval);
    else current.setFullYear(current.getFullYear() + rule.interval);
  }
  return occurrences;
}

export function parseICSEvents(text: string): GoogleEvent[] {
  const lines = unfoldICS(text);
  const events: GoogleEvent[] = [];
  let inEvent = false;
  let summary = '';
  let dtstart = '';
  let allDay = false;
  let rrule: string | null = null;
  let exdates: string[] = [];
  let uid = '';
  let counter = 0;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      summary = '';
      dtstart = '';
      allDay = false;
      rrule = null;
      exdates = [];
      uid = '';
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (inEvent && dtstart) {
        const startDate = parseICSDate(dtstart, allDay);
        if (startDate) {
          const exSet = new Set(exdates);
          const baseId = uid || `google-${counter++}`;
          if (!rrule) {
            events.push({ id: baseId, summary: summary || '(Sans titre)', date: toISO(startDate), startAt: allDay ? null : startDate.toISOString() });
          } else {
            const rule = parseRRule(rrule);
            if (rule) {
              for (const occ of expandRecurring(startDate, rule)) {
                if (exSet.has(toISO(occ))) continue;
                events.push({
                  id: `${baseId}-${toISO(occ)}`,
                  summary: summary || '(Sans titre)',
                  date: toISO(occ),
                  startAt: allDay ? null : occ.toISOString(),
                });
              }
            }
          }
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
      const idx = line.indexOf(':');
      if (idx >= 0) rrule = line.slice(idx + 1);
    } else if (line.startsWith('EXDATE')) {
      const idx = line.indexOf(':');
      if (idx >= 0) {
        for (const raw of line.slice(idx + 1).split(',')) {
          const d = parseICSDate(raw, !raw.includes('T'));
          if (d) exdates.push(toISO(d));
        }
      }
    } else if (line.startsWith('UID')) {
      const idx = line.indexOf(':');
      if (idx >= 0) uid = line.slice(idx + 1);
    }
  }

  return events;
}

export async function fetchGoogleEvents(url: string): Promise<GoogleEventsResult> {
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) {
      return { events: [], error: `Le calendrier a répondu avec une erreur (${res.status}). Vérifie l'adresse iCal dans les réglages.` };
    }
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return { events: [], error: "L'adresse ne pointe pas vers un fichier iCal valide (.ics)." };
    }
    return { events: parseICSEvents(text), error: null };
  } catch (e) {
    return { events: [], error: `Impossible de joindre ce calendrier — ${e instanceof Error ? e.message : 'erreur réseau'}.` };
  }
}
