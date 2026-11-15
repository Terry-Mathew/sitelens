import { describe, it, expect } from 'vitest';
import { loadHtml } from '@/lib/html';
import { parseJsonLd, typesOf, findDeep, hasAddress, hasTelephone } from '@/lib/checks/ai/jsonld';

const doc = (...blocks: string[]) =>
  loadHtml(`<html><head>${blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join('')}</head><body></body></html>`);

describe('parseJsonLd', () => {
  it('returns no nodes for a page without JSON-LD', () => {
    expect(parseJsonLd(loadHtml('<html></html>'))).toEqual({ nodes: [], invalidBlocks: 0 });
  });

  it('counts invalid JSON and does not throw', () => {
    const r = parseJsonLd(doc('{ not json', '{"@type":"Organization"}'));
    expect(r.invalidBlocks).toBe(1);
    expect(r.nodes).toHaveLength(1);
  });

  it('flattens arrays and @graph', () => {
    const r = parseJsonLd(doc('[{"@type":"A"},{"@graph":[{"@type":"B"},{"@type":"C"}]}]'));
    expect(typesOf(r.nodes).sort()).toEqual(['A', 'B', 'C']);
  });

  it('ignores JSON values that are not objects', () => {
    const r = parseJsonLd(doc('"text"', '42', 'null'));
    expect(r.nodes).toEqual([]);
    expect(r.invalidBlocks).toBe(0);
  });
});

describe('typesOf', () => {
  it('accepts a string or an array for @type and removes duplicates', () => {
    const { nodes } = parseJsonLd(doc('{"@type":["Organization","LocalBusiness"]}', '{"@type":"Organization"}'));
    expect(typesOf(nodes)).toEqual(['Organization', 'LocalBusiness']);
  });

  it('returns every type without a cap', () => {
    const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ '@type': `T${i}` })));
    expect(typesOf(parseJsonLd(doc(many)).nodes)).toHaveLength(30);
  });
});

describe('findDeep, hasTelephone, hasAddress', () => {
  it('finds a nested telephone', () => {
    const { nodes } = parseJsonLd(doc('{"@type":"Organization","contactPoint":{"telephone":"+44 113 000"}}'));
    expect(findDeep(nodes, 'telephone')).toEqual(['+44 113 000']);
    expect(hasTelephone(nodes)).toBe(true);
  });

  it('rejects an empty telephone', () => {
    expect(hasTelephone(parseJsonLd(doc('{"telephone":"  "}')).nodes)).toBe(false);
  });

  it('accepts an address as a string', () => {
    expect(hasAddress(parseJsonLd(doc('{"address":"1 High Street, Leeds"}')).nodes)).toBe(true);
  });

  it('accepts a PostalAddress object', () => {
    const { nodes } = parseJsonLd(doc('{"address":{"@type":"PostalAddress","streetAddress":"1 High Street"}}'));
    expect(hasAddress(nodes)).toBe(true);
  });

  it('rejects an empty address object', () => {
    expect(hasAddress(parseJsonLd(doc('{"address":{"@type":"PostalAddress"}}')).nodes)).toBe(false);
  });
});
