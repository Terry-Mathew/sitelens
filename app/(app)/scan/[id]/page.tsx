import { ScanDashboard } from '@/components/dashboard/ScanDashboard';

export default async function ScanPage({ params }: PageProps<'/scan/[id]'>) {
  const { id } = await params;
  return <ScanDashboard id={id} />;
}
