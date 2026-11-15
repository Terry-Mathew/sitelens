import type { LimitationCode } from '@/lib/types';

export const LIMITATION_TEXT: Record<LimitationCode, string> = {
  firecrawl_unavailable:
    'The page could not be loaded in a browser, so content added by JavaScript may not have been checked.',
  homepage_blocked: 'The website blocked our automated check, so some items could not be reviewed.',
  homepage_unreachable: 'The website could not be reached, so most items could not be reviewed.',
  non_html: 'The address did not return a normal web page, so page content could not be reviewed.',
  too_large: 'The page was too large to review in full, so some items could not be checked.',
  js_fallback:
    'This page appears to rely on JavaScript to show its content, so some items may not have been fully checked.',
  robots_unavailable: 'The site’s robots.txt file could not be read, so crawler access was not reviewed.',
  sitemap_unavailable: 'The site’s sitemap could not be read, so it was not reviewed.',
  performance_unavailable: 'Performance data was unavailable at the time of the review.',
  field_data_unavailable: 'Google does not have enough real-user data for this site.',
};
