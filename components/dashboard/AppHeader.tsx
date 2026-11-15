'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { clearAll } from '@/lib/storage';

/** A small lens mark: an outer ring and an offset inner disc. */
function LensMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-primary">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="10" r="4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  function onClear() {
    clearAll();
    // The home page reads browser storage when it loads, so load it again.
    if (pathname === '/') window.location.reload();
    else router.push('/');
  }

  async function onLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // The proxy sends the user to the login page if the cookie stays.
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-auto flex items-center gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LensMark />
          <span className="text-base font-semibold tracking-tight text-foreground">SiteLens</span>
        </Link>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="ghost" />}>Clear all data</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes all saved scans, report drafts, and branding from this browser. You cannot undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onClear}>
                Clear all data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
