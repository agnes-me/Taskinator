import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { GoogleEvent } from '@/lib/google-ical';
import { getValidAccessToken } from '@/lib/google-oauth';
import { listEvents, type GoogleApiEvent } from '@/lib/google-calendar-api';

/** Événements des agendas Google connectés (OAuth) et visibles, éditables depuis Taskinator. */
export async function fetchOAuthCalendarEvents(
  supabase: SupabaseServerClient,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ events: GoogleEvent[]; errors: { label: string; message: string }[] }> {
  const token = await getValidAccessToken(supabase, userId);
  if (!token) return { events: [], errors: [] };

  const { data: calendars } = await supabase
    .from('google_calendars')
    .select('id, google_calendar_id, label, color, visible')
    .eq('user_id', userId);
  const visible = (calendars ?? []).filter((c) => c.visible);
  if (visible.length === 0) return { events: [], errors: [] };

  const results = await Promise.all(
    visible.map(async (cal) => {
      try {
        const items = await listEvents(token, cal.google_calendar_id, rangeStart.toISOString(), rangeEnd.toISOString());
        return { cal, items, error: null as string | null };
      } catch (e) {
        return { cal, items: [] as GoogleApiEvent[], error: e instanceof Error ? e.message : 'Erreur Google Calendar' };
      }
    }),
  );

  const events: GoogleEvent[] = results.flatMap(({ cal, items }) =>
    items
      .filter((ev) => ev.start)
      .map((ev) => {
        const allDay = !ev.start?.dateTime;
        return {
          id: `oauth-${cal.id}:${ev.id}`,
          summary: ev.summary || '(Sans titre)',
          date: (ev.start?.date ?? ev.start?.dateTime ?? '').slice(0, 10),
          startAt: allDay ? null : (ev.start?.dateTime ?? null),
          calendarLabel: cal.label,
          calendarColor: cal.color,
          editable: true,
          googleCalendarId: cal.google_calendar_id,
          googleEventId: ev.id,
        };
      }),
  );

  const errors = results.filter((r) => r.error).map((r) => ({ label: r.cal.label, message: r.error as string }));
  return { events, errors };
}
