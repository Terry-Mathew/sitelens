import type { Check } from '@/lib/types';
import { check as siteReachable } from '@/lib/checks/technical/site-reachable';
import { check as https } from '@/lib/checks/technical/https';
import { check as httpRedirect } from '@/lib/checks/technical/http-redirect';
import { check as redirectChain } from '@/lib/checks/technical/redirect-chain';
import { check as indexable } from '@/lib/checks/technical/indexable';
import { check as robotsPresent } from '@/lib/checks/technical/robots-present';
import { check as robotsAllows } from '@/lib/checks/technical/robots-allows';
import { check as sitemap } from '@/lib/checks/technical/sitemap';
import { check as title } from '@/lib/checks/technical/title';
import { check as metaDescription } from '@/lib/checks/technical/meta-description';
import { check as singleH1 } from '@/lib/checks/technical/single-h1';
import { check as canonical } from '@/lib/checks/technical/canonical';
import { check as htmlLang } from '@/lib/checks/technical/html-lang';
import { check as viewport } from '@/lib/checks/technical/viewport';
import { check as imgAlt } from '@/lib/checks/technical/img-alt';
import { check as openGraph } from '@/lib/checks/technical/open-graph';
import { check as favicon } from '@/lib/checks/technical/favicon';
import { check as wordCount } from '@/lib/checks/content/word-count';
import { check as copyrightYear } from '@/lib/checks/content/copyright-year';
import { check as headingOrder } from '@/lib/checks/content/heading-order';
import { check as contactMethod } from '@/lib/checks/conversion/contact-method';
import { check as clickToCall } from '@/lib/checks/conversion/click-to-call';
import { check as cta } from '@/lib/checks/conversion/cta';
import { check as analytics } from '@/lib/checks/conversion/analytics';

export const checks: Check[] = [
  siteReachable, https, httpRedirect, redirectChain, indexable, robotsPresent,
  robotsAllows, sitemap, title, metaDescription, singleH1, canonical,
  htmlLang, viewport, imgAlt, openGraph, favicon,
  wordCount, copyrightYear, headingOrder,
  contactMethod, clickToCall, cta, analytics,
];
