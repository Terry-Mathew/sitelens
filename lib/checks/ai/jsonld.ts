import type { CheerioAPI } from 'cheerio';

export type JsonLdNode = Record<string, unknown>;

const MAX_TYPES = 20;

function isNode(value: unknown): value is JsonLdNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Adds each object in a parsed block. Arrays and @graph lists are opened.
function collect(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, out));
  } else if (isNode(value)) {
    out.push(value);
    if ('@graph' in value) collect(value['@graph'], out);
  }
}

/** Reads every JSON-LD block. A block that is not valid JSON is counted and skipped. */
export function parseJsonLd($: CheerioAPI): { nodes: JsonLdNode[]; invalidBlocks: number } {
  const nodes: JsonLdNode[] = [];
  let invalidBlocks = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collect(JSON.parse($(el).text()), nodes);
    } catch {
      invalidBlocks += 1;
    }
  });
  return { nodes, invalidBlocks };
}

/** Unique @type values, in document order. A @type can be a string or a list. */
export function typesOf(nodes: JsonLdNode[]): string[] {
  const types = new Set<string>();
  for (const node of nodes) {
    const raw = node['@type'];
    for (const t of Array.isArray(raw) ? raw : [raw]) {
      if (typeof t === 'string' && t.trim() !== '') types.add(t.trim());
    }
  }
  return [...types].slice(0, MAX_TYPES);
}

/** Every value stored under `key`, at any depth. */
export function findDeep(nodes: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (isNode(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (k === key) found.push(v);
        visit(v);
      }
    }
  };
  visit(nodes);
  return found;
}

// An address is text, or an object such as PostalAddress with at least one text field.
function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasText);
  if (isNode(value)) {
    return Object.entries(value).some(([k, v]) => !k.startsWith('@') && typeof v === 'string' && v.trim() !== '');
  }
  return false;
}

export function hasTelephone(nodes: JsonLdNode[]): boolean {
  return findDeep(nodes, 'telephone').some((v) => typeof v === 'string' && v.trim() !== '');
}

export function hasAddress(nodes: JsonLdNode[]): boolean {
  return findDeep(nodes, 'address').some(hasText);
}
