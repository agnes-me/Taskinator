'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import type { CalendarTask } from '@/lib/data/tasks';
import { completeTask } from '@/app/(app)/c/[containerId]/tasks/actions';

export interface CalendarEvent {
  id: string;
  name: string;
  event_date: string;
}

const PRIORITY_DOT: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-amber-500', high: 'bg-rose-500' };
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthHref(containerId: string, year: number, month: number): string {
  return `/c/${containerId}/calendar?month=${year}-${String(month + 1).padStart(2, '0')}`;
}

export function CalendarClient({
  containerId,
  year,
  month,
  tasks,
  events,
  canEdit,
}: {
  containerId: string;
  year: number;
  month: number;
  tasks: CalendarTask[];
  events: CalendarEvent[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const tasksByDate = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const list = tasksByDate.get(t.due_date) ?? [];
    list.push(t);
    tasksByDate.set(t.due_date, list);
  }
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.event_date) ?? [];
    list.push(e);
    eventsByDate.set(e.event_date, list);
  }

  const todayISOStr = toISO(new Date());
  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const monthLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  function quickComplete(taskId: string) {
    startTransition(async () => {
      await completeTask(taskId, containerId, new FormData());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={monthHref(containerId, prev.y, prev.m)} className="btn btn-ghost !px-3 !py-1 text-sm">
          ←
        </Link>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <Link href={monthHref(containerId, next.y, next.m)} className="btn btn-ghost !px-3 !py-1 text-sm">
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--text-muted)]">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === month;
          const dayTasks = tasksByDate.get(iso) ?? [];
          const dayEvents = eventsByDate.get(iso) ?? [];
          const isToday = iso === todayISOStr;
          return (
            <div
              key={iso}
              className={`card flex min-h-[92px] flex-col gap-1 p-1.5 text-xs ${inMonth ? '' : 'opacity-40'} ${isToday ? '!border-brand-500' : ''}`}
            >
              <span className={`self-end text-[11px] ${isToday ? 'font-bold text-brand-600' : 'text-[var(--text-muted)]'}`}>{d.getDate()}</span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.map((e) => (
                  <span key={e.id} className="truncate rounded bg-brand-500/10 px-1 py-0.5 text-[10px] text-brand-600" title={e.name}>
                    🎉 {e.name}
                  </span>
                ))}
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    disabled={!canEdit || pending || t.status === 'done'}
                    onClick={() => quickComplete(t.id)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    title={`${t.title}${t.room ? ` · ${t.room.name}` : ''}${t.event ? ` · ${t.event.name}` : ''}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    <span className={`truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && <span className="text-[10px] text-[var(--text-muted)]">+{dayTasks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
