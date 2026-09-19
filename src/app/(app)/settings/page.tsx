import { createClient } from '@/lib/supabase/server';
import { ThemeGradientForm } from './ThemeGradientForm';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('theme_gradient, display_name').eq('id', user?.id ?? '').maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Réglages</h1>
        <p className="text-sm text-[var(--text-muted)]">Personnalisation propre à ton compte — visible uniquement par toi.</p>
      </div>

      <ThemeGradientForm initialColors={profile?.theme_gradient ?? ['#14b8a6', '#6366f1']} />
    </div>
  );
}
