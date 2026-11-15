import { AppHeader } from '@/components/dashboard/AppHeader';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          Scanned URLs are sent to Firecrawl and Google PageSpeed Insights for analysis. Results are stored only in this
          browser.
        </p>
      </footer>
    </div>
  );
}
