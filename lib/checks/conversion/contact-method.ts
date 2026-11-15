import type { CheerioAPI } from 'cheerio';
import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';

// The last path segment of a contact page, for example /contact, /contact-us/ or /en/get-in-touch.html.
const CONTACT_PATH = /^(?:contact|contact-us|get-in-touch)(?:\.[a-z]+)?$/i;
const CONTACT_TEXT = /^contact(?:\s+us)?$/i;
const MESSAGING_HOSTS = new Set(['wa.me', 'api.whatsapp.com']);

function urlOf(href: string): URL | null {
  try {
    // The base is only for relative links. Only the path and the host are read.
    return new URL(href, 'https://page.invalid/');
  } catch {
    return null;
  }
}

function hasContactPageLink($: CheerioAPI): boolean {
  return $('a[href]')
    .toArray()
    .some((el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (CONTACT_TEXT.test(text)) return true;
      const url = urlOf(el.attribs.href ?? '');
      if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) return false;
      const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
      return CONTACT_PATH.test(last);
    });
}

function hasMessagingLink($: CheerioAPI): boolean {
  return $('a[href]')
    .toArray()
    .some((el) => {
      const href = (el.attribs.href ?? '').trim();
      if (/^sms:/i.test(href)) return true;
      const url = urlOf(href);
      return url !== null && MESSAGING_HOSTS.has(url.hostname.toLowerCase());
    });
}

export const check: Check = {
  id: 'contact-method',
  category: 'conversion',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const evidence = {
        tel: $('a[href^="tel:" i]').length > 0,
        mailto: $('a[href^="mailto:" i]').length > 0,
        form: $('form').length > 0,
        contactPageLink: hasContactPageLink($),
        messaging: hasMessagingLink($),
        formEmbed: $('iframe[src*="form" i]').length > 0,
      };
      if (Object.values(evidence).some(Boolean)) return pass(evidence, source);
      // Heuristic: a contact method can exist in a way that this check cannot see. It is never Critical.
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};
