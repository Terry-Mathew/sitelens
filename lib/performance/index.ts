import { pageSpeedProvider } from '@/lib/performance/providers/pagespeed';
import type { PerformanceProvider } from '@/lib/performance/types';

// The rest of the app imports only from this file (spec 17.6).
export type {
  CwvRating,
  FieldMetric,
  PageSpeedOutcome,
  PageSpeedResult,
  PerformanceProvider,
} from '@/lib/performance/types';
export { normalisePageSpeed, pageSpeedProvider } from '@/lib/performance/providers/pagespeed';

export function getPerformanceProvider(): PerformanceProvider {
  return pageSpeedProvider;
}
