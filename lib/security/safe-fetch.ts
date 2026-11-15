import { isIP } from 'node:net';
import { request, type Dispatcher } from 'undici';
import {
  BlockedAddressError,
  createSafeAgent,
  defaultResolveAll,
  type AddressPolicy,
  type ResolveAll,
} from './agent';
import { isPrivateAddress } from './ip';
import { bareHostname, isLocalhostName } from './url';

export const SITELENS_USER_AGENT = 'Mozilla/5.0 (compatible; SiteLensBot/1.0)';
export const DEFAULT_MAX_REDIRECTS = 5;

// 'dns' means the name does not exist. 'dns_transient' means the lookup failed for a reason that can pass.
export type SafeFetchReason =
  | 'timeout'
  | 'blocked_address'
  | 'too_many_redirects'
  | 'too_large'
  | 'network'
  | 'dns'
  | 'dns_transient';

export type SafeFetchOptions = {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  method?: 'GET' | 'HEAD';
};

/**
 * `redirectChain` lists, in order, every URL that answered with a redirect
 * (so its length is the number of redirects followed); `finalUrl` is the URL
 * that produced the returned response. Bodies over `maxBytes` are aborted and
 * reported as `too_large`, so `truncated` is currently always false.
 */
export type SafeFetchResult =
  | {
      ok: true;
      status: number;
      finalUrl: string;
      redirectChain: string[];
      headers: Record<string, string>;
      body: string;
      truncated: boolean;
    }
  | { ok: false; reason: SafeFetchReason; message: string };

/**
 * Construction-time configuration. Production code uses the strict defaults
 * via the exported `safeFetch`; overrides exist so tests can inject a fake
 * resolver and reach a local test server. Never derive these from user input.
 */
export type SafeFetchConfig = {
  resolveAll?: ResolveAll;
  isBlockedAddress?: AddressPolicy;
  allowedPorts?: number[];
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DNS_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'EAI_NONAME', 'EAI_NODATA', 'ENODATA']);
const DNS_TRANSIENT_CODES = new Set(['EAI_AGAIN', 'EAI_FAIL', 'ESERVFAIL', 'ETIMEOUT']);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

type Failure = Extract<SafeFetchResult, { ok: false }>;
const fail = (reason: SafeFetchReason, message: string): Failure => ({ ok: false, reason, message });

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function flattenHeaders(headers: Dispatcher.ResponseData['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

function decodeBody(bytes: Buffer, contentType: string | undefined): string {
  const charset = contentType?.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1];
  if (charset) {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // Unknown label: fall back to UTF-8.
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Drops a response body without leaving an unhandled 'error' event behind. */
function discard(body: Dispatcher.ResponseData['body']): void {
  body.on('error', () => {});
  body.destroy();
}

/** Collects an error, its `cause` chain and any AggregateError members. */
function relatedErrors(err: unknown, seen = new Set<unknown>()): unknown[] {
  if (err == null || typeof err !== 'object' || seen.has(err)) return [];
  seen.add(err);
  const out: unknown[] = [err];
  const e = err as { cause?: unknown; errors?: unknown };
  if (e.cause) out.push(...relatedErrors(e.cause, seen));
  if (Array.isArray(e.errors)) for (const inner of e.errors) out.push(...relatedErrors(inner, seen));
  return out;
}

function classifyError(err: unknown, timedOut: boolean): Failure {
  if (timedOut) return fail('timeout', 'The request timed out.');
  const errors = relatedErrors(err);
  const codeOf = (e: unknown) => (e as { code?: unknown }).code;
  if (errors.some((e) => e instanceof BlockedAddressError)) {
    return fail('blocked_address', 'The address resolves to a private or reserved network and was not fetched.');
  }
  if (errors.some((e) => DNS_TRANSIENT_CODES.has(String(codeOf(e))))) {
    return fail('dns_transient', 'The domain name lookup failed for a temporary reason.');
  }
  if (errors.some((e) => DNS_NOT_FOUND_CODES.has(String(codeOf(e))))) {
    return fail('dns', 'The domain name could not be resolved.');
  }
  if (errors.some((e) => TIMEOUT_CODES.has(String(codeOf(e))))) {
    return fail('timeout', 'The request timed out.');
  }
  const message = err instanceof Error ? err.message : 'Unknown network error';
  return fail('network', `The request failed: ${message}`);
}

/**
 * Per-hop checks that must happen before dispatch. IP-literal hosts are checked
 * here because `net.connect` skips `lookup` for them; hostnames are validated
 * inside the agent's connect-time lookup.
 */
function checkHop(url: URL, isBlocked: AddressPolicy, allowedPorts: ReadonlySet<number>): Failure | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('blocked_address', `Only http and https URLs can be fetched (got ${url.protocol}).`);
  }
  if (url.username || url.password) {
    return fail('blocked_address', 'URLs containing credentials are not fetched.');
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!allowedPorts.has(port)) {
    return fail('blocked_address', `Port ${port} is not allowed; only standard web ports are fetched.`);
  }
  const host = bareHostname(url.hostname);
  if (!host || isLocalhostName(host)) {
    return fail('blocked_address', 'Local addresses are not fetched.');
  }
  // WHATWG URL parsing has already canonicalised decimal/hex/octal IPv4 and IPv6 forms.
  if (isIP(host) && isBlocked(host)) {
    return fail('blocked_address', 'The address is private or reserved and was not fetched.');
  }
  return null;
}

/** Builds a guarded fetcher. Use the exported `safeFetch` in application code. */
export function createSafeFetch(config: SafeFetchConfig = {}) {
  const resolveAll = config.resolveAll ?? defaultResolveAll;
  const isBlocked = config.isBlockedAddress ?? isPrivateAddress;
  const allowedPorts: ReadonlySet<number> = new Set(config.allowedPorts ?? [80, 443]);
  const agent = createSafeAgent(resolveAll, isBlocked);

  return async function safeFetch(input: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
    const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let method: 'GET' | 'HEAD' = opts.method ?? 'GET';

    let current: URL;
    try {
      current = new URL(input);
    } catch {
      return fail('network', 'The URL is not valid.');
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs);

    try {
      const redirectChain: string[] = [];
      for (;;) {
        const blocked = checkHop(current, isBlocked, allowedPorts);
        if (blocked) return blocked;

        // undici `request` never follows redirects on its own; every hop is
        // dispatched here, through the safe agent, after `checkHop`.
        const res = await request(current.href, {
          method,
          dispatcher: agent,
          signal: controller.signal,
          headers: { 'user-agent': SITELENS_USER_AGENT, accept: '*/*' },
        });

        const location = firstHeader(res.headers.location);
        if (REDIRECT_STATUSES.has(res.statusCode) && location) {
          discard(res.body);
          if (redirectChain.length >= maxRedirects) {
            return fail('too_many_redirects', `Stopped after ${maxRedirects} redirects.`);
          }
          let next: URL;
          try {
            next = new URL(location, current);
          } catch {
            return fail('network', 'The server sent an invalid redirect location.');
          }
          redirectChain.push(current.href);
          if (res.statusCode === 303 && method !== 'HEAD') method = 'GET';
          current = next;
          continue;
        }

        const headers = flattenHeaders(res.headers);
        if (method === 'HEAD') {
          await res.body.dump();
          return { ok: true, status: res.statusCode, finalUrl: current.href, redirectChain, headers, body: '', truncated: false };
        }

        const declared = Number(headers['content-length']);
        if (Number.isFinite(declared) && declared > opts.maxBytes) {
          discard(res.body);
          return fail('too_large', `The response is larger than the ${opts.maxBytes}-byte limit.`);
        }

        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of res.body) {
          const buf = chunk as Buffer;
          total += buf.length;
          if (total > opts.maxBytes) {
            discard(res.body);
            return fail('too_large', `The response is larger than the ${opts.maxBytes}-byte limit.`);
          }
          chunks.push(buf);
        }

        return {
          ok: true,
          status: res.statusCode,
          finalUrl: current.href,
          redirectChain,
          headers,
          body: decodeBody(Buffer.concat(chunks), headers['content-type']),
          truncated: false,
        };
      }
    } catch (err) {
      return classifyError(err, timedOut);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** The SSRF-guarded fetcher with strict defaults (real DNS, ports 80/443, full private-range policy). */
export const safeFetch = createSafeFetch();
