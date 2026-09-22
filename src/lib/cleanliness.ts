import type { RecurrenceType, TaskStatus } from '@/types/database';
import { defaultFreshnessDaysFromRecurrence } from '@/lib/recurrence';

/**
 * Indicateur de propreté/fraîcheur dégressif (façon Tody/Sweepy) : 100% juste après
 * complétion, qui décroît jusqu'à 0% à l'échéance de validité (freshness_days).
 * Une tâche/catégorie/conteneur en pause (vacances, blessure...) ou hors saison est gelée.
 */
export type FreshnessLevel = 'high' | 'mid' | 'low';

export interface FreshnessInput {
  lastCompletedAt: string | null;
  freshnessDays: number;
  pausedUntil?: string | null;
  seasonalStartMonth?: number | null;
  seasonalEndMonth?: number | null;
  now?: Date;
}

export interface FreshnessResult {
  percent: number;
  level: FreshnessLevel;
  frozen: boolean;
  outOfSeason: boolean;
  daysSinceCompletion: number | null;
}

export function isPaused(pausedUntil: string | null | undefined, now = new Date()): boolean {
  if (!pausedUntil) return false;
  return new Date(pausedUntil).getTime() > now.getTime();
}

export function isInSeason(startMonth: number | null | undefined, endMonth: number | null | undefined, now = new Date()): boolean {
  if (!startMonth || !endMonth) return true;
  const month = now.getMonth() + 1;
  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }
  // saison à cheval sur l'année (ex: novembre -> février)
  return month >= startMonth || month <= endMonth;
}

export function computeFreshness(input: FreshnessInput): FreshnessResult {
  const now = input.now ?? new Date();
  const frozen = isPaused(input.pausedUntil, now);
  const outOfSeason = !isInSeason(input.seasonalStartMonth, input.seasonalEndMonth, now);

  if (!input.lastCompletedAt) {
    return { percent: 0, level: 'low', frozen, outOfSeason, daysSinceCompletion: null };
  }

  const daysSince = Math.max(0, (now.getTime() - new Date(input.lastCompletedAt).getTime()) / 86_400_000);
  const validity = Math.max(1, input.freshnessDays || 7);
  const percent = frozen || outOfSeason ? 100 : Math.max(0, Math.round(100 * (1 - daysSince / validity)));
  const level: FreshnessLevel = percent >= 60 ? 'high' : percent >= 25 ? 'mid' : 'low';

  return { percent, level, frozen, outOfSeason, daysSinceCompletion: Math.round(daysSince) };
}

/** Agrège plusieurs indicateurs (ex: toutes les tâches d'une catégorie) en une moyenne pondérée. */
export function aggregateFreshness(results: FreshnessResult[]): FreshnessResult {
  if (results.length === 0) {
    return { percent: 100, level: 'high', frozen: false, outOfSeason: false, daysSinceCompletion: null };
  }
  const percent = Math.round(results.reduce((sum, r) => sum + r.percent, 0) / results.length);
  const level: FreshnessLevel = percent >= 60 ? 'high' : percent >= 25 ? 'mid' : 'low';
  return {
    percent,
    level,
    frozen: results.every((r) => r.frozen),
    outOfSeason: results.every((r) => r.outOfSeason),
    daysSinceCompletion: null,
  };
}

export interface FreshnessTaskLike {
  status: TaskStatus;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_weekdays: string | null;
  last_completed_at: string | null;
  freshness_days: number | null;
  paused_until: string | null;
  seasonal_start_month: number | null;
  seasonal_end_month: number | null;
}

/**
 * Fraîcheur "effective" d'une tâche, seule brique commune utilisée pour agréger une pièce/un
 * conteneur (tasks.ts, rooms.ts, dashboard.ts) — trois cas :
 *  - récurrente : la courbe de dégradation habituelle (computeFreshness).
 *  - ponctuelle avec des sous-tâches récurrentes (tâche "conteneur" type "Ménage complet") :
 *    moyenne de la fraîcheur de ces sous-tâches, jamais son propre statut (qui repasse "à faire"
 *    immédiatement après complétion, cf. after_task_completion).
 *  - ponctuelle sans sous-tâche récurrente (checklist simple) : binaire, 100% si cochée sinon 0% —
 *    auparavant ignorée du calcul, ce qui faisait afficher 100% à une pièce entière de tâches
 *    ponctuelles non cochées.
 */
export function taskFreshness(
  task: FreshnessTaskLike,
  fallbackFreshnessDays: number,
  subtasks: FreshnessTaskLike[] = [],
  now?: Date,
): FreshnessResult {
  if (task.recurrence_type !== 'none') {
    return computeFreshness({
      lastCompletedAt: task.last_completed_at,
      freshnessDays:
        task.freshness_days ??
        defaultFreshnessDaysFromRecurrence(task.recurrence_type, task.recurrence_interval, task.recurrence_weekdays) ??
        fallbackFreshnessDays,
      pausedUntil: task.paused_until,
      seasonalStartMonth: task.seasonal_start_month,
      seasonalEndMonth: task.seasonal_end_month,
      now,
    });
  }

  const recurringSubtasks = subtasks.filter((s) => s.recurrence_type !== 'none');
  if (recurringSubtasks.length > 0) {
    return aggregateFreshness(recurringSubtasks.map((s) => taskFreshness(s, fallbackFreshnessDays, [], now)));
  }

  const done = task.status === 'done';
  return { percent: done ? 100 : 0, level: done ? 'high' : 'low', frozen: false, outOfSeason: false, daysSinceCompletion: null };
}

export const FRESHNESS_COLORS: Record<FreshnessLevel, string> = {
  high: '#22c55e',
  mid: '#f59e0b',
  low: '#ef4444',
};
