import type { RecurrenceType } from '@/lib/types';

/**
 * Calcule la prochaine échéance d'une tâche récurrente (façon Sweepy) :
 * on repart de la date de complétion (ou d'aujourd'hui si jamais faite)
 * et on applique la période choisie.
 */
export function computeNextDueDate(params: {
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceWeekdays: string | null;
  from: Date;
}): Date | null {
  const { recurrenceType, recurrenceInterval, recurrenceWeekdays, from } = params;
  const interval = Math.max(1, recurrenceInterval || 1);
  const base = new Date(from);

  switch (recurrenceType) {
    case 'NONE':
      return null;
    case 'DAILY': {
      const next = new Date(base);
      next.setDate(next.getDate() + interval);
      return next;
    }
    case 'WEEKLY': {
      if (recurrenceWeekdays) {
        return nextWeekdayFrom(base, recurrenceWeekdays);
      }
      const next = new Date(base);
      next.setDate(next.getDate() + interval * 7);
      return next;
    }
    case 'MONTHLY': {
      const next = new Date(base);
      next.setMonth(next.getMonth() + interval);
      // "Tous les X mois, le samedi" : on recale sur le prochain jour visé
      // (jusqu'à 6 jours plus tard) plutôt que de garder le même quantième.
      const singleWeekday = parseSingleWeekday(recurrenceWeekdays);
      return singleWeekday ? snapForwardToWeekday(next, singleWeekday) : next;
    }
    case 'CUSTOM_DAYS': {
      const next = new Date(base);
      next.setDate(next.getDate() + interval);
      return next;
    }
    default:
      return null;
  }
}

function parseSingleWeekday(csv: string | null): number | null {
  if (!csv) return null;
  const n = parseInt(csv.split(',')[0]?.trim() ?? '', 10);
  return n >= 1 && n <= 7 ? n : null;
}

/** Avance `date` (0 à 6 jours) jusqu'au prochain jour correspondant au jour ISO visé (1=lundi...7=dimanche). */
function snapForwardToWeekday(date: Date, isoWeekday: number): Date {
  const cursor = new Date(date);
  for (let i = 0; i < 7; i++) {
    const currentIso = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (currentIso === isoWeekday) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

/** 1=lundi ... 7=dimanche (ISO). Retourne la prochaine date >= from+1j qui tombe sur un des jours listés. */
function nextWeekdayFrom(from: Date, csvWeekdays: string): Date {
  const wanted = csvWeekdays
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= 7);

  if (wanted.length === 0) {
    const next = new Date(from);
    next.setDate(next.getDate() + 7);
    return next;
  }

  const cursor = new Date(from);
  for (let i = 1; i <= 14; i++) {
    cursor.setDate(from.getDate() + i);
    const isoDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (wanted.includes(isoDay)) {
      return new Date(cursor);
    }
  }
  return new Date(from);
}

export function isRemindersPaused(pausedUntil: Date | null | undefined): boolean {
  if (!pausedUntil) return false;
  return pausedUntil.getTime() > Date.now();
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
  7: 'Dim',
};

export const WEEKDAY_FULL_LABELS: Record<number, string> = {
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
  7: 'dimanche',
};

/**
 * Libellé naturel de la périodicité, ex: "Tous les 3 mois, le samedi",
 * "Toutes les 2 semaines", "Tous les jours" — au lieu d'un cryptique "(×3)".
 */
export function buildRecurrenceLabel(
  type: RecurrenceType,
  interval: number,
  weekdaysCsv: string | null,
): string {
  const n = Math.max(1, interval || 1);
  const weekdays = (weekdaysCsv ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
  const weekdayNames = weekdays.map((d) => WEEKDAY_FULL_LABELS[d]);
  const weekdaySuffix =
    weekdayNames.length === 0 ? '' : weekdayNames.length === 1 ? `, le ${weekdayNames[0]}` : `, les ${weekdayNames.join(', ')}`;

  switch (type) {
    case 'NONE':
      return 'Ponctuelle';
    case 'DAILY':
    case 'CUSTOM_DAYS':
      return n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
    case 'WEEKLY':
      return (n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`) + weekdaySuffix;
    case 'MONTHLY':
      return (n === 1 ? 'Tous les mois' : `Tous les ${n} mois`) + weekdaySuffix;
    default:
      return 'Ponctuelle';
  }
}
