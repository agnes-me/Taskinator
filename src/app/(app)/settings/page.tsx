import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { ThemeGradientForm } from './ThemeGradientForm';
import { IcalSubscriptionsForm } from './IcalSubscriptionsForm';

export default async function SettingsPage() {
  const user = await getAuthUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: subscriptions }] = await Promise.all([
    supabase.from('profiles').select('theme_gradient, display_name').eq('id', user?.id ?? '').maybeSingle(),
    supabase.from('ical_subscriptions').select('id, label, url').eq('user_id', user?.id ?? '').order('sort_order'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-gradient text-2xl font-extrabold">Réglages</h1>
        <div className="gradient-bar mt-2 mb-1" />
        <p className="text-sm text-[var(--text-muted)]">Personnalisation propre à ton compte — visible uniquement par toi.</p>
      </div>

      <ThemeGradientForm initialColors={profile?.theme_gradient ?? ['#14b8a6', '#6366f1']} />
      <IcalSubscriptionsForm subscriptions={subscriptions ?? []} />
    </div>
  );
}
