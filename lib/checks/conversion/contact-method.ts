import type { CheerioAPI } from 'cheerio';
import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';

// The last path segment of a contact page, for example /contact, /contact-us/ or /en/get-in-touch.html.
const CONTACT_PATH = /^(?:contact|contact-us|get-in-touch)(?:\.[a-z]+)?$/i;
const CONTACT_TEXT = /^contact(?:\s+us)?$/i;
const MESSAGING_HOSTS = new Set(['wa.me', 'api.whatsapp.com']);
// Known hosts of embedded form services. A match is a substring of the iframe host and path.
const FORM_HOSTS = [
  'docs.google.com/forms', 'forms.gle', 'typeform.com', 'jotform', 'hsforms',
  'tally.so', 'formstack', 'cognitoforms', 'wufoo',
];
const SEARCH_FIELD_NAMES = new Set(['s', 'q', 'query']);
// Input types that hold text that a person types.
const TEXT_INPUT_TYPES = new Set(['', 'text', 'email', 'tel', 'url']);

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

type Selection = ReturnType<CheerioAPI>;

function inputType(field: Selection): string {
  return (field.attr('type') ?? '').toLowerCase();
}

function isSearchForm($: CheerioAPI, form: Selection): boolean {
  if ((form.attr('role') ?? '').toLowerCase() === 'search') return true;
  if ((form.attr('action') ?? '').toLowerCase().includes('search')) return true;
  if (form.find('input[type="search" i]').length > 0) return true;
  const fields = form
    .find('input, textarea, select')
    .filter((_, el) => !['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType($(el))));
  return fields.length === 1 && SEARCH_FIELD_NAMES.has((fields.attr('name') ?? '').toLowerCase());
}

/**
 * A form counts as a contact form when it has a message box, a phone field, or an email
 * field together with a second text field. A search form or a one-field newsletter form does not count.
 */
function hasContactForm($: CheerioAPI): boolean {
  return $('form')
    .toArray()
    .some((el) => {
      const form = $(el);
      if (isSearchForm($, form)) return false;
      if (form.find('textarea, input[type="tel" i]').length > 0) return true;
      const textInputs = form.find('input').filter((_, i) => TEXT_INPUT_TYPES.has(inputType($(i))));
      return form.find('input[type="email" i]').length > 0 && textInputs.length >= 2;
    });
}

function hasFormEmbed($: CheerioAPI): boolean {
  return $('iframe[src]')
    .toArray()
    .some((el) => {
      const url = urlOf(el.attribs.src ?? '');
      if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) return false;
      const target = `${url.hostname}${url.pathname}`.toLowerCase();
      return FORM_HOSTS.some((host) => target.includes(host));
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
        form: hasContactForm($),
        contactPageLink: hasContactPageLink($),
        messaging: hasMessagingLink($),
        formEmbed: hasFormEmbed($),
      };
      if (Object.values(evidence).some(Boolean)) return pass(evidence, source);
      // Heuristic: a contact method can exist in a way that this check cannot see. It is never Critical.
      return { status: 'fail', severity: 'warning', evidence, source };
    }),
};
