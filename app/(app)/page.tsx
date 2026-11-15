import { RecentScans } from '@/components/dashboard/RecentScans';
import { ScanForm } from '@/components/dashboard/ScanForm';

export default function HomePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Review a homepage</h1>
          <p className="max-w-[60ch] text-muted-foreground">
            Enter the address of a possible client. SiteLens finds problems that it can prove and shows the evidence.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <ScanForm />
        </div>
      </section>
      <RecentScans />
    </div>
  );
}
