import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSafeFetch, safeFetch, SITELENS_USER_AGENT } from '@/lib/security/safe-fetch';
import { normaliseAndValidateUrl } from '@/lib/security/url';
import { isPrivateAddress } from '@/lib/security/ip';
import type { ResolveAll, ResolvedAddress } from '@/lib/security/agent';

/*
 * A local HTTP server on 127.0.0.1 stands in for "public" sites. Hostnames
 * under `.test` are resolved by an injected fake (never real DNS), and a
 * test-only policy exempts exactly 127.0.0.1 so the server is reachable.
 * Every other private/reserved address is still blocked by the real policy.
 * No test touches the real network.
 */

let server: http.Server;
let port: number;
const requests: { url: string; host?: string; ua?: string; method?: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push({ url: req.url ?? '', host: req.headers.host, ua: req.headers['user-agent'], method: req.method });
    const u = new URL(req.url ?? '/', 'http://x');
    const p = u.pathname;
    if (p === '/a') return void res.writeHead(302, { location: '/b' }).end();
    if (p === '/b') return void res.writeHead(301, { location: `http://other.test:${port}/c` }).end();
    if (p === '/c') return void res.writeHead(200, { 'content-type': 'text/html', 'x-test': 'yes' }).end('<p>ok</p>');
    if (p === '/to-private') return void res.writeHead(302, { location: `http://internal.test:${port}/` }).end();
    if (p === '/to-metadata') return void res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end();
    if (p === '/to-loopback-literal') return void res.writeHead(307, { location: 'http://[::ffff:127.0.0.1]/' }).end();
    if (p === '/to-ftp') return void res.writeHead(302, { location: 'ftp://other.test/' }).end();
    if (p === '/to-creds') return void res.writeHead(302, { location: `http://u:p@other.test:${port}/c` }).end();
    if (p === '/to-port') return void res.writeHead(302, { location: 'http://other.test:8080/' }).end();
    if (p.startsWith('/hop/')) {
      const n = Number(p.split('/')[2]);
      const stop = Number(u.searchParams.get('stop') ?? 'Infinity');
      if (n >= stop) return void res.writeHead(200).end(`done after ${n}`);
      return void res.writeHead(302, { location: `/hop/${n + 1}?stop=${stop}` }).end();
    }
    if (p === '/big-cl') {
      res.writeHead(200, { 'content-length': '5000' });
      return void res.end('x'.repeat(5000));
    }
    if (p === '/big-chunked') {
      res.writeHead(200); // no content-length => chunked
      let sent = 0;
      const iv = setInterval(() => {
        if (sent >= 20 || res.destroyed) {
          clearInterval(iv);
          return void res.end();
        }
        res.write('y'.repeat(500));
        sent++;
      }, 1);
      return;
    }
    if (p === '/exact') return void res.writeHead(200).end('z'.repeat(1000));
    if (p === '/hang') return; // never responds
    if (p === '/slow-body') {
      res.writeHead(200);
      res.write('start');
      return; // never ends
    }
    res.writeHead(404).end('not found');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
});

const LOCAL: ResolvedAddress[] = [{ address: '127.0.0.1', family: 4 }];

function fakeResolver(): ResolveAll {
  return vi.fn<ResolveAll>(async (hostname) => {
    if (hostname === 'site.test' || hostname === 'other.test') return LOCAL;
    if (hostname === 'internal.test') return [{ address: '10.0.0.7', family: 4 }];
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' });
  });
}

/** Fetcher wired to the local server. Only 127.0.0.1 is exempted from the real policy. */
function localFetch(resolveAll: ResolveAll = fakeResolver()) {
  return createSafeFetch({
    resolveAll,
    isBlockedAddress: (ip) => ip !== '127.0.0.1' && isPrivateAddress(ip),
    allowedPorts: [80, 443, port],
  });
}

const OPTS = { timeoutMs: 3000, maxBytes: 100_000 };
const base = () => `http://site.test:${port}`;

describe('safeFetch', () => {
  it('follows redirects manually and records the chain', async () => {
    const res = await localFetch()(`${base()}/a`, OPTS);
    expect(res).toMatchObject({
      ok: true,
      status: 200,
      finalUrl: `http://other.test:${port}/c`,
      redirectChain: [`${base()}/a`, `${base()}/b`],
      body: '<p>ok</p>',
      truncated: false,
    });
    if (!res.ok) throw new Error('unreachable');
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.headers['x-test']).toBe('yes');
  });

  it('returns non-2xx responses as ok:true with the status', async () => {
    const res = await localFetch()(`${base()}/missing`, OPTS);
    expect(res).toMatchObject({ ok: true, status: 404, body: 'not found', redirectChain: [] });
  });

  it('blocks a redirect to a private address', async () => {
    const before = requests.length;
    const res = await localFetch()(`${base()}/to-private`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
    expect(requests.length - before).toBe(1); // only the first hop reached a server
  });

  it('blocks redirect to http://169.254.169.254/', async () => {
    const resolve = fakeResolver();
    const res = await localFetch(resolve)(`${base()}/to-metadata`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
    expect(resolve).not.toHaveBeenCalledWith('169.254.169.254');
  });

  it('blocks a redirect to an IPv4-mapped IPv6 loopback literal', async () => {
    const res = await localFetch()(`${base()}/to-loopback-literal`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
  });

  it.each(['/to-ftp', '/to-creds', '/to-port'])('re-validates scheme, credentials and port on redirect hop %s', async (path) => {
    const res = await localFetch()(`${base()}${path}`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
  });

  it('allows exactly 5 redirects', async () => {
    const res = await localFetch()(`${base()}/hop/0?stop=5`, OPTS);
    expect(res).toMatchObject({ ok: true, status: 200, body: 'done after 5' });
    if (!res.ok) throw new Error('unreachable');
    expect(res.redirectChain).toHaveLength(5);
  });

  it('stops after 5 redirects', async () => {
    const res = await localFetch()(`${base()}/hop/0`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'too_many_redirects' });
  });

  it('honours a custom maxRedirects', async () => {
    const res = await localFetch()(`${base()}/hop/0?stop=2`, { ...OPTS, maxRedirects: 1 });
    expect(res).toMatchObject({ ok: false, reason: 'too_many_redirects' });
  });

  it('aborts bodies over maxBytes (content-length)', async () => {
    const res = await localFetch()(`${base()}/big-cl`, { ...OPTS, maxBytes: 1000 });
    expect(res).toMatchObject({ ok: false, reason: 'too_large' });
  });

  it('aborts bodies over maxBytes (streamed, no content-length)', async () => {
    const res = await localFetch()(`${base()}/big-chunked`, { ...OPTS, maxBytes: 1000 });
    expect(res).toMatchObject({ ok: false, reason: 'too_large' });
  });

  it('accepts a body of exactly maxBytes', async () => {
    const res = await localFetch()(`${base()}/exact`, { ...OPTS, maxBytes: 1000 });
    expect(res).toMatchObject({ ok: true, status: 200 });
    if (!res.ok) throw new Error('unreachable');
    expect(res.body).toHaveLength(1000);
  });

  it('times out waiting for headers', async () => {
    const started = Date.now();
    const res = await localFetch()(`${base()}/hang`, { ...OPTS, timeoutMs: 200 });
    expect(res).toMatchObject({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('times out while reading a stalled body', async () => {
    const res = await localFetch()(`${base()}/slow-body`, { ...OPTS, timeoutMs: 200 });
    expect(res).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('sends the SiteLensBot user agent', async () => {
    expect(SITELENS_USER_AGENT).toBe('Mozilla/5.0 (compatible; SiteLensBot/1.0)');
    const before = requests.length;
    await localFetch()(`${base()}/a`, OPTS);
    const hops = requests.slice(before);
    expect(hops.length).toBe(3);
    for (const hop of hops) expect(hop.ua).toBe('Mozilla/5.0 (compatible; SiteLensBot/1.0)');
  });

  it('supports HEAD requests', async () => {
    const before = requests.length;
    const res = await localFetch()(`${base()}/c`, { ...OPTS, method: 'HEAD' });
    expect(res).toMatchObject({ ok: true, status: 200, body: '' });
    expect(requests[before].method).toBe('HEAD');
  });

  it('reports DNS failures as dns', async () => {
    const res = await localFetch()(`http://nowhere.test:${port}/`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'dns' });
  });

  it.each(['EAI_AGAIN', 'EAI_FAIL', 'ESERVFAIL'])('reports a temporary DNS failure (%s) as dns_transient', async (code) => {
    const flaky = vi.fn<ResolveAll>(async () => {
      throw Object.assign(new Error(`getaddrinfo ${code} flaky.test`), { code });
    });
    const res = await localFetch(flaky)(`http://flaky.test:${port}/`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'dns_transient' });
    expect(JSON.stringify(res)).not.toContain('flaky.test');
  });

  it('reports connection failures as network', async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', () => r()));
    const deadPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));
    const fetcher = createSafeFetch({
      resolveAll: fakeResolver(),
      isBlockedAddress: (ip) => ip !== '127.0.0.1' && isPrivateAddress(ip),
      allowedPorts: [deadPort],
    });
    const res = await fetcher(`http://site.test:${deadPort}/`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'network' });
  });

  it('reports a TLS failure as tls', async () => {
    // The local server speaks plain HTTP, so the TLS handshake fails.
    const res = await localFetch()(`https://site.test:${port}/c`, OPTS);
    expect(res).toMatchObject({ ok: false, reason: 'tls' });
  });

  describe('connection-time validation (real policy)', () => {
    it('DNS rebinding: validation passes then lookup at connect returns 127.0.0.1 → blocked_address', async () => {
      let calls = 0;
      const rebinding = vi.fn<ResolveAll>(async () => {
        calls++;
        return calls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
      });
      const checked = await normaliseAndValidateUrl('rebind.example', rebinding);
      expect(checked).toEqual({ ok: true, url: 'https://rebind.example/' });

      // Default policy and default ports: the connect-time lookup sees 127.0.0.1 and refuses.
      const fetcher = createSafeFetch({ resolveAll: rebinding });
      const res = await fetcher('http://rebind.example/', OPTS);
      expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
      expect(rebinding).toHaveBeenCalledTimes(2);
    });

    it('blocks when any of multiple resolved addresses is private', async () => {
      const multi = vi.fn<ResolveAll>(async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]);
      const res = await createSafeFetch({ resolveAll: multi })('http://multi.example/', OPTS);
      expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
    });

    it.each([
      'http://[::ffff:127.0.0.1]/',
      'http://2130706433/',
      'http://0x7f.0.0.1/',
      'http://0177.0.0.1/',
      'http://127.1/',
      'http://[::1]/',
      'http://[::]/',
      'http://0.0.0.0/',
      'http://169.254.169.254/',
      'https://10.0.0.1/',
      'http://[fd00::1]/',
      'http://[64:ff9b::7f00:1]/',
    ])('blocks IP-literal host %s before connecting', async (url) => {
      const resolve = vi.fn<ResolveAll>(async () => [{ address: '93.184.216.34', family: 4 }]);
      const res = await createSafeFetch({ resolveAll: resolve })(url, OPTS);
      expect(res).toMatchObject({ ok: false, reason: 'blocked_address' });
      expect(resolve).not.toHaveBeenCalled();
    });

    it.each(['ftp://example.com/', 'file:///etc/passwd', 'https://u:p@example.com/', 'http://example.com:8080/', 'not a url'])(
      'rejects invalid initial URL %s without connecting',
      async (url) => {
        const resolve = vi.fn<ResolveAll>(async () => [{ address: '93.184.216.34', family: 4 }]);
        const res = await createSafeFetch({ resolveAll: resolve })(url, OPTS);
        expect(res.ok).toBe(false);
        expect(resolve).not.toHaveBeenCalled();
      },
    );

    it('the default safeFetch export enforces the strict policy', async () => {
      expect(await safeFetch('http://127.0.0.1/', OPTS)).toMatchObject({ ok: false, reason: 'blocked_address' });
      expect(await safeFetch('http://[::ffff:7f00:1]/', OPTS)).toMatchObject({ ok: false, reason: 'blocked_address' });
      expect(await safeFetch(`http://site.test:${port}/`, OPTS)).toMatchObject({ ok: false, reason: 'blocked_address' });
    });
  });
});
