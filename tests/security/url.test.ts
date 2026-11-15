import { describe, it, expect, vi } from 'vitest';
import { normaliseAndValidateUrl } from '@/lib/security/url';
import type { ResolveAll } from '@/lib/security/agent';

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];

/** Fake resolver: no real DNS in tests. */
function resolver(map: Record<string, { address: string; family: number }[]> = {}): ResolveAll {
  return vi.fn(async (hostname: string) => {
    if (hostname in map) return map[hostname];
    return PUBLIC;
  });
}

describe('normaliseAndValidateUrl', () => {
  it('adds https and strips path/query/whitespace', async () => {
    const res = await normaliseAndValidateUrl(' Example.com/about?x=1 ', resolver());
    expect(res).toEqual({ ok: true, url: 'https://example.com/' });
  });

  it('always returns https, also when the user typed http', async () => {
    expect(await normaliseAndValidateUrl('http://example.com/page#x', resolver())).toEqual({
      ok: true,
      url: 'https://example.com/',
    });
    expect(await normaliseAndValidateUrl('HTTPS://WWW.Example.com', resolver())).toEqual({
      ok: true,
      url: 'https://www.example.com/',
    });
  });

  it('accepts explicit standard ports and drops them', async () => {
    expect(await normaliseAndValidateUrl('https://example.com:443/x', resolver())).toEqual({
      ok: true,
      url: 'https://example.com/',
    });
    expect(await normaliseAndValidateUrl('http://example.com:80', resolver())).toEqual({
      ok: true,
      url: 'https://example.com/',
    });
  });

  it('converts IDN to punycode', async () => {
    const resolve = resolver();
    const res = await normaliseAndValidateUrl('café.fr', resolve);
    expect(res).toEqual({ ok: true, url: 'https://xn--caf-dma.fr/' });
    expect(resolve).toHaveBeenCalledWith('xn--caf-dma.fr');
  });

  it.each(['ftp://x.com', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'mailto:a@x.com', 'ws://x.com'])(
    'rejects non-http schemes: %s',
    async (input) => {
      const res = await normaliseAndValidateUrl(input, resolver());
      expect(res.ok).toBe(false);
    },
  );

  it.each(['https://user:pass@x.com', 'https://user@x.com', 'http://:pass@x.com'])(
    'rejects credentials in URL: %s',
    async (input) => {
      const res = await normaliseAndValidateUrl(input, resolver());
      expect(res.ok).toBe(false);
    },
  );

  it.each(['https://x.com:8080', 'x.com:8443', 'http://x.com:22'])('rejects non-standard ports: %s', async (input) => {
    const res = await normaliseAndValidateUrl(input, resolver());
    expect(res.ok).toBe(false);
  });

  it.each([
    'localhost',
    'http://localhost/',
    'foo.localhost',
    'localhost.',
    '127.0.0.1',
    '[::1]',
    '10.0.0.5',
    '169.254.169.254',
    'http://[::ffff:127.0.0.1]/',
    '2130706433',
    '0x7f.0.0.1',
    '0177.0.0.1',
    '127.1',
    'http://0.0.0.0/',
  ])('rejects localhost and IP-literal private hosts: %s', async (input) => {
    const resolve = resolver();
    const res = await normaliseAndValidateUrl(input, resolve);
    expect(res.ok).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('accepts a public IP literal without DNS', async () => {
    const resolve = resolver();
    expect(await normaliseAndValidateUrl('8.8.8.8', resolve)).toEqual({ ok: true, url: 'https://8.8.8.8/' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('rejects hostnames resolving to private IPs', async () => {
    const res = await normaliseAndValidateUrl(
      'intranet.example.com',
      resolver({ 'intranet.example.com': [{ address: '192.168.1.10', family: 4 }] }),
    );
    expect(res.ok).toBe(false);
  });

  it('rejects when any of several resolved addresses is private', async () => {
    const res = await normaliseAndValidateUrl(
      'mixed.example.com',
      resolver({
        'mixed.example.com': [
          { address: '93.184.216.34', family: 4 },
          { address: '::1', family: 6 },
        ],
      }),
    );
    expect(res.ok).toBe(false);
  });

  it('rejects when DNS lookup fails', async () => {
    const failing: ResolveAll = async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND nope.invalid'), { code: 'ENOTFOUND' });
    };
    const res = await normaliseAndValidateUrl('nope.invalid', failing);
    expect(res.ok).toBe(false);
  });

  it.each(['', '   ', 'http://', 'https://exa mple.com'])('rejects empty or malformed input %j', async (input) => {
    const res = await normaliseAndValidateUrl(input, resolver());
    expect(res.ok).toBe(false);
  });

  it('returns a plain-language error string on rejection', async () => {
    const res = await normaliseAndValidateUrl('ftp://x.com', resolver());
    if (res.ok) throw new Error('expected rejection');
    expect(typeof res.error).toBe('string');
    expect(res.error.length).toBeGreaterThan(0);
  });
});
