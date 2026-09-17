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
      return next;
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

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  NONE: 'Ponctuelle',
  DAILY: 'Tous les jours',
  WEEKLY: 'Toutes les semaines',
  MONTHLY: 'Tous les mois',
  CUSTOM_DAYS: 'Intervalle personnalisé (jours)',
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
  7: 'Dim',
};
