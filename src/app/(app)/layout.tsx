import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdsWithContainers } from '@/lib/data/nav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SignOutButton } from '@/components/SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const households = await getHouseholdsWithContainers(supabase);
  if (households.length === 0) redirect('/onboarding');

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const { data: profile } = await supabase.from('profiles').select('theme_gradient').eq('id', user.id).maybeSingle();
  const gradientColors = profile?.theme_gradient?.length ? profile.theme_gradient : ['#14b8a6', '#6366f1'];
  const userGradient = `linear-gradient(135deg, ${gradientColors.join(', ')})`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ ['--user-gradient' as string]: userGradient }}>
      <aside className="card m-3 flex shrink-0 flex-col gap-4 p-4 md:w-64">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
          <span className="gradient-surface flex h-8 w-8 items-center justify-center rounded-xl text-base">🧺</span> Taskinator
        </Link>

        <nav className="flex flex-col gap-1">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]">
            📊 Tableau de bord
          </Link>
        </nav>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {households.map((h) => (
            <div key={h.id}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h.name}</p>
              <div className="mt-1 flex flex-col gap-1">
                {h.containers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/c/${c.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                      style={{ background: c.color + '33' }}
                    >
                      {c.icon}
                    </span>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          <Link href="/settings" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]">
            🎨 Personnaliser
          </Link>
          {isAdmin && (
            <Link href="/admin/moderation" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]">
              🛡️ Modération marketplace
            </Link>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-[var(--text-muted)]">{user.email}</span>
            <ThemeToggle />
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-3 md:p-6">{children}</main>
    </div>
  );
}
