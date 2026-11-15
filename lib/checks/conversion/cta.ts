import type { Check } from '@/lib/types';
import { pass, withTextHtml } from '@/lib/checks/helpers';

const PHRASES = [
  'contact', 'call', 'book', 'quote', 'get started', 'buy', 'enquire', 'inquire', 'schedule',
  'request', 'sign up', 'order', 'shop', 'get in touch', 'free consultation',
];
const PATTERN = new RegExp(`\\b(?:${PHRASES.map((p) => p.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
const MAX_MATCHES = 5;
// A real button or link has short text. Long text is a sentence and is not a call to action.
const MAX_TEXT_LENGTH = 60;

export const check: Check = {
  id: 'cta',
  category: 'conversion',
  confidence: 'heuristic',
  run: (page) =>
    withTextHtml(page, ({ $, source }) => {
      const texts = $('a, button, input[type="submit" i]')
        .toArray()
        .map((el) => {
          const raw = el.tagName === 'input' ? el.attribs.value ?? '' : $(el).text();
          return raw.replace(/\s+/g, ' ').trim();
        })
        .filter((text) => text !== '' && text.length <= MAX_TEXT_LENGTH && PATTERN.test(text));
      const evidence = { matches: texts.slice(0, MAX_MATCHES) };
      if (texts.length > 0) return pass(evidence, source);
      return { status: 'fail', severity: 'opportunity', evidence, source };
    }),
};
