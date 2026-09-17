import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentHousehold } from '@/lib/current-household';
import { NavBar } from '@/components/NavBar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const household = await getCurrentHousehold(session.user.id);
  if (!household) {
    redirect('/register');
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
