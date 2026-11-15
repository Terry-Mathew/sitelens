import dns from 'node:dns';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { Agent } from 'undici';
import { isPrivateAddress } from './ip';

export type ResolvedAddress = { address: string; family: number };

/** Resolves a hostname to every address it maps to. Injectable for tests. */
export type ResolveAll = (hostname: string) => Promise<ResolvedAddress[]>;

/** Predicate deciding whether an address must never be connected to. */
export type AddressPolicy = (ip: string) => boolean;

export const defaultResolveAll: ResolveAll = (hostname) =>
  dns.promises.lookup(hostname, { all: true, order: 'verbatim' });

export class BlockedAddressError extends Error {
  readonly code = 'ERR_SITELENS_BLOCKED_ADDRESS';
  constructor(
    readonly hostname: string,
    readonly address: string,
  ) {
    super(`Refusing to connect to ${hostname}: it resolves to a private or reserved address (${address})`);
    this.name = 'BlockedAddressError';
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * A `net.connect`-compatible `lookup` that resolves ALL addresses for the
 * hostname, rejects if ANY of them is private/reserved, and hands the socket
 * only the addresses it has just validated. Because the socket connects to the
 * value returned here, there is no window between "check" and "connect" for a
 * DNS answer to change (DNS rebinding).
 */
export function createSafeLookup(resolveAll: ResolveAll = defaultResolveAll, isBlocked: AddressPolicy = isPrivateAddress) {
  return function safeLookup(hostname: string, options: LookupOptions | undefined, callback: LookupCallback): void {
    const opts: LookupOptions = options ?? {};

    resolveAll(hostname).then(
      (addresses) => {
        // Validate every address before filtering, so no private record can hide behind a family filter.
        const blocked = addresses.find((a) => isBlocked(a.address));
        if (blocked) return callback(new BlockedAddressError(hostname, blocked.address), '');

        const family = opts.family === 'IPv4' ? 4 : opts.family === 'IPv6' ? 6 : opts.family;
        const usable = family === 4 || family === 6 ? addresses.filter((a) => a.family === family) : addresses;
        if (usable.length === 0) {
          const err: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
          err.code = 'ENOTFOUND';
          return callback(err, '');
        }
        if (opts.all) return callback(null, usable.map((a) => ({ address: a.address, family: a.family })));
        return callback(null, usable[0].address, usable[0].family);
      },
      (err: NodeJS.ErrnoException) => callback(err, ''),
    );
  };
}

/**
 * undici Agent whose every new connection is validated at connect time.
 * IP-literal hosts skip `lookup` in `net.connect`, so callers MUST check
 * literals with `isPrivateAddress` before dispatching (safeFetch does).
 */
export function createSafeAgent(resolveAll: ResolveAll = defaultResolveAll, isBlocked: AddressPolicy = isPrivateAddress): Agent {
  return new Agent({
    connect: { lookup: createSafeLookup(resolveAll, isBlocked) },
  });
}
