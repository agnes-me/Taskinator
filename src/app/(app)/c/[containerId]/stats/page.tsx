import { createClient } from '@/lib/supabase/server';
import { getContainerStatsByPerson } from '@/lib/data/stats';
import { PRIORITY_LABELS } from '@/lib/recurrence';
import type { Priority } from '@/types/database';

const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high'];

export default async function StatsPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const stats = await getContainerStatsByPerson(supabase, containerId);
  const totalCompleted = stats.reduce((sum, s) => sum + s.completedCount, 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">📊 Statistiques par personne</h2>

      {stats.length === 0 ? (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">Aucune tâche cochée pour l'instant dans ce conteneur.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.user_id} className="card flex flex-col gap-3 p-4">
              <div className="font-semibold">{s.display_name}</div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Tâches cochées</span>
                <span className="font-semibold">
                  {s.completedCount}
                  {totalCompleted > 0 && (
                    <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                      ({Math.round((s.completedCount / totalCompleted) * 100)}%)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">En retard</span>
                <span className={`font-semibold ${s.lateCount > 0 ? 'text-fresh-low' : ''}`}>{s.lateCount}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">Par difficulté</span>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_ORDER.map((p) => (
                    <span key={p} className="chip bg-[var(--surface-muted)] text-xs">
                      {PRIORITY_LABELS[p]} · {s.byPriority[p]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
