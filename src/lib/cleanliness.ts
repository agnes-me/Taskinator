/**
 * Indicateur de propreté/fraîcheur dégressif (façon Tody/Sweepy) : 100% juste après
 * complétion, qui décroît jusqu'à 0% à l'échéance de validité (freshness_days).
 * Une tâche/pièce/conteneur en pause (vacances, blessure...) ou hors saison est gelée.
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

/** Agrège plusieurs indicateurs (ex: toutes les tâches d'une pièce) en une moyenne pondérée. */
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

export const FRESHNESS_COLORS: Record<FreshnessLevel, string> = {
  high: '#22c55e',
  mid: '#f59e0b',
  low: '#ef4444',
};
