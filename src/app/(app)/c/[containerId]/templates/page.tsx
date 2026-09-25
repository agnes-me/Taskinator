import { redirect } from 'next/navigation';

export default async function TemplatesPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  redirect(`/c/${containerId}/settings?tab=rooms`);
}
