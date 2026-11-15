import type { CheckCopy } from '@/lib/types';

// Pre-written copy per check id. Entries are added alongside each check.
export const CHECK_COPY: Record<string, CheckCopy> = {
  'site-reachable': {
    title: 'Site reachable',
    clientTitle: 'Your website did not load',
    whyItMatters:
      'When the homepage does not load, visitors and search engines cannot see your business. You can lose enquiries until it works again.',
    howToFix:
      'Ask your web host or developer to check that the domain points to the site and that the server is running. Then test the address in a browser.',
  },
  https: {
    title: 'Secure connection (HTTPS)',
    clientTitle: 'Your website does not use a secure connection',
    whyItMatters:
      'Browsers can show a "Not secure" warning on sites without HTTPS. Visitors may leave, and Google may treat the site as less trustworthy.',
    howToFix:
      'Install an SSL certificate. Most hosts offer one for free. Then make sure every page loads with https:// in the address.',
  },
  'http-redirect': {
    title: 'HTTP to HTTPS redirect',
    clientTitle: 'The old, insecure address does not forward to the secure one',
    whyItMatters:
      'People who type or click an old http:// link can land on an insecure copy of your site. Search engines may also see two versions of each page.',
    howToFix:
      'Ask your host or developer to add a permanent (301) redirect from http:// to https:// for the whole site.',
  },
  'redirect-chain': {
    title: 'Redirect chain',
    clientTitle: 'Visitors are sent through several redirects before the homepage loads',
    whyItMatters:
      'Each extra redirect adds waiting time. Long chains can slow the first visit and may make it harder for search engines to follow.',
    howToFix:
      'Ask your developer to redirect each old address straight to the final homepage address in one step.',
  },
  indexable: {
    title: 'Homepage can be indexed',
    clientTitle: 'Your homepage tells search engines not to list it',
    whyItMatters:
      'A "noindex" instruction asks Google to keep the page out of search results. People who search for your business may not find it.',
    howToFix:
      'Remove the noindex instruction from the homepage meta robots tag or from the X-Robots-Tag server header. In WordPress, clear the "Discourage search engines" setting.',
  },
  'robots-present': {
    title: 'robots.txt file',
    clientTitle: 'Whether your site has a robots.txt file',
    whyItMatters:
      'A robots.txt file gives search engines simple rules for crawling your site. Many sites work well without one, so this is a fact and not a fault.',
    howToFix:
      'If you want to guide search engines, add a robots.txt file at the root of your site. Your developer or SEO plugin can create it.',
  },
  'robots-allows': {
    title: 'robots.txt allows crawling',
    clientTitle: 'Your robots.txt file blocks search engines from the whole site',
    whyItMatters:
      'A rule that blocks the whole site asks search engines not to visit any page. Your site may not appear in search results.',
    howToFix:
      'Open your robots.txt file and remove the line "Disallow: /" for all crawlers. Keep rules only for private areas such as /admin.',
  },
  sitemap: {
    title: 'XML sitemap',
    clientTitle: 'Your site has no working sitemap',
    whyItMatters:
      'A sitemap lists your pages for search engines. Without one, new or deep pages can take longer to be found.',
    howToFix:
      'Create an XML sitemap at /sitemap.xml. Most website platforms and SEO plugins can do this. Then add the address to your robots.txt file.',
  },
  title: {
    title: 'Title tag',
    clientTitle: 'Your homepage title needs attention',
    whyItMatters:
      'The title is the main line people see in search results and browser tabs. A missing, short or long title can reduce clicks.',
    howToFix:
      'Write a clear title of about 30 to 60 characters. Include your business name and what you do.',
  },
  'meta-description': {
    title: 'Meta description',
    clientTitle: 'Your homepage summary for search results needs attention',
    whyItMatters:
      'The description is the short text under your title in search results. A good one can help people decide to click.',
    howToFix:
      'Write a summary of about 70 to 160 characters. Say what you offer and invite the visitor to act.',
  },
  'single-h1': {
    title: 'Single H1 heading',
    clientTitle: 'Your homepage does not have exactly one main heading',
    whyItMatters:
      'The main heading tells visitors and search engines what the page is about. Zero or many main headings can make the topic unclear.',
    howToFix:
      'Use one main heading (H1) on the homepage. Change other large headings to H2 or lower.',
  },
  canonical: {
    title: 'Canonical tag',
    clientTitle: 'Your homepage does not name its preferred address correctly',
    whyItMatters:
      'A canonical tag tells search engines which address is the main one. A missing tag or one that points to another site can split or lose ranking signals.',
    howToFix:
      'Add a canonical link in the page head that points to the preferred homepage address on your own domain.',
  },
  'html-lang': {
    title: 'Page language',
    clientTitle: 'Your homepage does not state its language',
    whyItMatters:
      'The language setting helps browsers, screen readers and search engines handle your text correctly.',
    howToFix:
      'Add a lang attribute to the html tag, for example lang="en". Your developer or theme settings can do this.',
  },
  viewport: {
    title: 'Mobile viewport',
    clientTitle: 'Your homepage is not set up for phone screens',
    whyItMatters:
      'Without a viewport tag, phones can show a shrunken desktop page that is hard to read. Many visitors browse on a phone.',
    howToFix:
      'Add this tag to the page head: meta name="viewport" content="width=device-width, initial-scale=1".',
  },
  'img-alt': {
    title: 'Image alt text',
    clientTitle: 'Some images on your homepage have no description',
    whyItMatters:
      'Alt text describes an image for people who use screen readers and for search engines. Missing text can hurt accessibility and image search.',
    howToFix:
      'Add a short description to each image that has meaning. Use an empty alt for purely decorative images.',
  },
  'open-graph': {
    title: 'Open Graph tags',
    clientTitle: 'Your homepage may look plain when shared on social media',
    whyItMatters:
      'Open Graph tags set the title and picture shown when someone shares your link. Without them, a shared link can look unclear.',
    howToFix:
      'Add og:title and og:image tags to the page head. Many SEO plugins can set these for you.',
  },
  favicon: {
    title: 'Favicon',
    clientTitle: 'Your site has no small icon for browser tabs',
    whyItMatters:
      'The favicon is the small icon in browser tabs and bookmarks. It helps visitors recognise your brand and can look more professional.',
    howToFix:
      'Add a square logo image as a favicon. Link it in the page head or place a favicon.ico file at the root of your site.',
  },
};
