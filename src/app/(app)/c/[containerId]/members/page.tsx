import { redirect } from 'next/navigation';

export default async function MembersPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  redirect(`/c/${containerId}/settings?tab=members`);
}
