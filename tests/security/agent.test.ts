import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { request } from 'undici';
import {
  BlockedAddressError,
  createSafeAgent,
  createSafeLookup,
  type ResolveAll,
  type ResolvedAddress,
} from '@/lib/security/agent';
import { isPrivateAddress } from '@/lib/security/ip';

type LookupResult = { err: NodeJS.ErrnoException | null; address?: unknown; family?: number };

function callLookup(lookup: ReturnType<typeof createSafeLookup>, hostname: string, options: object) {
  return new Promise<LookupResult>((resolve) => {
    lookup(hostname, options, (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) =>
      resolve({ err, address, family }),
    );
  });
}

const fixed =
  (addresses: ResolvedAddress[]): ResolveAll =>
  async () =>
    addresses;

describe('createSafeLookup', () => {
  it('rejects with BlockedAddressError when the only address is private', async () => {
    const lookup = createSafeLookup(fixed([{ address: '127.0.0.1', family: 4 }]));
    const { err } = await callLookup(lookup, 'evil.example', { all: true });
    expect(err).toBeInstanceOf(BlockedAddressError);
  });

  it('rejects when ANY resolved address is private, even if a public one comes first', async () => {
    const lookup = createSafeLookup(
      fixed([
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    );
    const all = await callLookup(lookup, 'mixed.example', { all: true });
    expect(all.err).toBeInstanceOf(BlockedAddressError);
    const single = await callLookup(lookup, 'mixed.example', {});
    expect(single.err).toBeInstanceOf(BlockedAddressError);
  });

  it('rejects a private IPv6 address hidden behind a family filter', async () => {
    // Validation covers every address, not just the family the socket asked for.
    const lookup = createSafeLookup(
      fixed([
        { address: '93.184.216.34', family: 4 },
        { address: 'fe80::1', family: 6 },
      ]),
    );
    const { err } = await callLookup(lookup, 'mixed6.example', { family: 4 });
    expect(err).toBeInstanceOf(BlockedAddressError);
  });

  it('returns exactly the validated addresses when all are public (all: true)', async () => {
    const addrs = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ];
    const lookup = createSafeLookup(fixed(addrs));
    const { err, address } = await callLookup(lookup, 'ok.example', { all: true });
    expect(err).toBeNull();
    expect(address).toEqual(addrs);
  });

  it('returns the first validated address for single lookups and honours family', async () => {
    const lookup = createSafeLookup(
      fixed([
        { address: '2606:4700::1111', family: 6 },
        { address: '1.1.1.1', family: 4 },
      ]),
    );
    expect(await callLookup(lookup, 'ok.example', {})).toEqual({ err: null, address: '2606:4700::1111', family: 6 });
    expect(await callLookup(lookup, 'ok.example', { family: 4 })).toEqual({ err: null, address: '1.1.1.1', family: 4 });
  });

  it('passes DNS errors through with their code', async () => {
    const lookup = createSafeLookup(async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' });
    });
    const { err } = await callLookup(lookup, 'x.invalid', { all: true });
    expect(err?.code).toBe('ENOTFOUND');
  });

  it('treats an empty result as a DNS failure', async () => {
    const lookup = createSafeLookup(fixed([]));
    const { err } = await callLookup(lookup, 'empty.example', { all: true });
    expect(err?.code).toBe('ENOTFOUND');
  });

  it('fails closed on garbage addresses', async () => {
    const lookup = createSafeLookup(fixed([{ address: 'not-an-ip', family: 4 }]));
    const { err } = await callLookup(lookup, 'garbage.example', { all: true });
    expect(err).toBeInstanceOf(BlockedAddressError);
  });
});

describe('createSafeAgent', () => {
  let server: http.Server | undefined;
  afterEach(async () => {
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
    server = undefined;
  });

  it('connects to the validated address (agent lookup result is used)', async () => {
    const seen: { host?: string; remote?: string }[] = [];
    server = http.createServer((req, res) => {
      seen.push({ host: req.headers.host, remote: req.socket.remoteAddress });
      res.end('hello');
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as AddressInfo;

    // `.test` never resolves in real DNS, so a successful request proves the
    // injected lookup result is what the socket connected to.
    const resolve = vi.fn<ResolveAll>(async () => [{ address: '127.0.0.1', family: 4 }]);
    // Test-only policy: allow exactly 127.0.0.1 so a local server can stand in for a public host.
    const agent = createSafeAgent(resolve, (ip) => ip !== '127.0.0.1' && isPrivateAddress(ip));
    try {
      const res = await request(`http://validated.test:${port}/`, { dispatcher: agent });
      expect(res.statusCode).toBe(200);
      expect(await res.body.text()).toBe('hello');
    } finally {
      await agent.close();
    }
    expect(resolve).toHaveBeenCalledWith('validated.test');
    expect(seen).toEqual([{ host: `validated.test:${port}`, remote: '127.0.0.1' }]);
  });

  it('refuses to connect when lookup returns a private address (default policy)', async () => {
    let hits = 0;
    server = http.createServer((_req, res) => {
      hits++;
      res.end('should not be reached');
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as AddressInfo;

    const agent = createSafeAgent(async () => [{ address: '127.0.0.1', family: 4 }]);
    try {
      await expect(request(`http://loopback.test:${port}/`, { dispatcher: agent })).rejects.toBeInstanceOf(
        BlockedAddressError,
      );
    } finally {
      await agent.close();
    }
    expect(hits).toBe(0);
  });
});
