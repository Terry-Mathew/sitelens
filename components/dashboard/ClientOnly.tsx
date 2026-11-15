'use client';

import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/** True after hydration. Browser storage can be read only then. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/** Renders the fallback on the server and the children in the browser. */
export function ClientOnly({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return useHydrated() ? children : fallback;
}
