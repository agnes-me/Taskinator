import type { RecurrenceType } from '@/types/database';

export const WEEKDAY_FULL_LABELS: Record<number, string> = {
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
  7: 'dimanche',
};

/** Libellé naturel de la périodicité, ex: "Tous les 3 mois", "Toutes les 2 semaines". */
export function recurrenceLabel(type: RecurrenceType, interval: number, weekdaysCsv: string | null): string {
  const n = Math.max(1, interval || 1);
  const weekdays = (weekdaysCsv ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
  const weekdayNames = weekdays.map((d) => WEEKDAY_FULL_LABELS[d]);
  const weekdaySuffix =
    weekdayNames.length === 0 ? '' : weekdayNames.length === 1 ? `, le ${weekdayNames[0]}` : `, les ${weekdayNames.join(', ')}`;

  switch (type) {
    case 'none':
      return 'Ponctuelle';
    case 'daily':
      return n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
    case 'custom_days':
      return `Tous les ${n} jours`;
    case 'weekly':
      return (n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`) + weekdaySuffix;
    case 'monthly':
      return (n === 1 ? 'Tous les mois' : `Tous les ${n} mois`) + weekdaySuffix;
    default:
      return 'Ponctuelle';
  }
}

export const PRIORITY_LABELS: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
export const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Faite',
  cancelled: 'Annulée',
};
export const ROLE_LABELS: Record<string, string> = { admin: 'Admin', member: 'Membre', guest: 'Invité·e' };
