import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { ThemeGradientForm } from './ThemeGradientForm';
import { IcalSubscriptionsForm } from './IcalSubscriptionsForm';
import { GoogleCalendarForm } from './GoogleCalendarForm';
import { GlobalSyncForm } from './GlobalSyncForm';
import { listMyManageableContainers } from './google-actions';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleConnected?: string; googleError?: string }>;
}) {
  const { googleConnected, googleError } = await searchParams;
  const user = await getAuthUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: subscriptions }, { data: googleAccount }, { data: googleCalendars }, manageableContainers] =
    await Promise.all([
      supabase.from('profiles').select('theme_gradient, display_name').eq('id', user?.id ?? '').maybeSingle(),
      supabase.from('ical_subscriptions').select('id, label, url, color, visible').eq('user_id', user?.id ?? '').order('sort_order'),
      supabase.from('google_oauth_accounts').select('user_id').eq('user_id', user?.id ?? '').maybeSingle(),
      supabase.from('google_calendars').select('id, google_calendar_id, label, color, visible').eq('user_id', user?.id ?? '').order('created_at'),
      listMyManageableContainers(),
    ]);

  const isConnected = Boolean(googleAccount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-gradient text-2xl font-extrabold">Réglages</h1>
        <div className="gradient-bar mt-2 mb-1" />
        <p className="text-sm text-[var(--text-muted)]">Personnalisation propre à ton compte — visible uniquement par toi.</p>
      </div>

      <ThemeGradientForm initialColors={profile?.theme_gradient ?? ['#14b8a6', '#6366f1']} />
      <GoogleCalendarForm
        connected={isConnected}
        calendars={googleCalendars ?? []}
        bannerConnected={googleConnected === '1'}
        bannerError={googleError ?? null}
      />
      <GlobalSyncForm googleConnected={isConnected} containers={'containers' in manageableContainers ? manageableContainers.containers : []} />
      <IcalSubscriptionsForm subscriptions={subscriptions ?? []} />
    </div>
  );
}
