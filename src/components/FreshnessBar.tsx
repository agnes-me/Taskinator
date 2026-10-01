import { FRESHNESS_COLORS, type FreshnessResult } from '@/lib/cleanliness';

export function FreshnessBar({ freshness, compact }: { freshness: FreshnessResult; compact?: boolean }) {
  const color = FRESHNESS_COLORS[freshness.level];
  const label = freshness.frozen ? 'En pause' : freshness.outOfSeason ? 'Hors saison' : `${freshness.percent}%`;

  return (
    <div className={compact ? '' : 'flex flex-col gap-1'}>
      {!compact && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Fraîcheur</span>
          <span className="font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${freshness.frozen || freshness.outOfSeason ? 100 : freshness.percent}%`, background: color, opacity: freshness.frozen || freshness.outOfSeason ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
}
