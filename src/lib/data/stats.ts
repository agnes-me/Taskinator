import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Priority } from '@/types/database';

export interface PersonStats {
  user_id: string;
  display_name: string;
  email: string;
  completedCount: number;
  lateCount: number;
  byPriority: Record<Priority, number>;
}

export async function getContainerStatsByPerson(supabase: SupabaseServerClient, containerId: string): Promise<PersonStats[]> {
  const { data: rows } = await supabase
    .from('task_completions')
    .select('completed_by, was_late, tasks!inner(container_id, priority)')
    .eq('tasks.container_id', containerId);

  if (!rows || rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.completed_by))];
  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name').in('id', userIds);

  const byUser = new Map<string, PersonStats>();
  for (const userId of userIds) {
    const p = profiles?.find((pr) => pr.id === userId);
    byUser.set(userId, {
      user_id: userId,
      display_name: p?.display_name ?? p?.email ?? '—',
      email: p?.email ?? '—',
      completedCount: 0,
      lateCount: 0,
      byPriority: { low: 0, medium: 0, high: 0 },
    });
  }

  for (const row of rows as unknown as { completed_by: string; was_late: boolean | null; tasks: { priority: Priority } }[]) {
    const stats = byUser.get(row.completed_by);
    if (!stats) continue;
    stats.completedCount += 1;
    if (row.was_late) stats.lateCount += 1;
    stats.byPriority[row.tasks.priority] += 1;
  }

  return [...byUser.values()].sort((a, b) => b.completedCount - a.completedCount);
}
