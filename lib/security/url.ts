import { isIP } from 'node:net';
import { defaultResolveAll, type ResolveAll } from './agent';
import { isPrivateAddress } from './ip';

export type UrlValidation = { ok: true; url: string } | { ok: false; error: string };

const ALLOWED_PORTS = new Set(['', '80', '443']);

// A leading "scheme:" that is not "host:port" (port starts with a digit).
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/i;

/** Strips IPv6 brackets and a trailing root dot for policy checks. */
export function bareHostname(hostname: string): string {
  let h = hostname;
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h.endsWith('.')) h = h.slice(0, -1);
  return h;
}

export function isLocalhostName(hostname: string): boolean {
  const h = bareHostname(hostname).toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost');
}

/**
 * Normalises user input to the site's homepage (`https://host/`, or
 * `http://host/` only when the user typed http) and rejects anything SiteLens
 * must not fetch: non-http(s) schemes, credentials, non-standard ports,
 * localhost, private/reserved IP literals (including decimal, hex, octal and
 * IPv4-mapped IPv6 encodings, which the WHATWG URL parser canonicalises), and
 * hostnames resolving to any private/reserved address.
 *
 * This is a pre-flight check only. The fetcher re-validates at connect time,
 * so a DNS answer that changes after this check (rebinding) is still blocked.
 */
export async function normaliseAndValidateUrl(
  input: string,
  resolveAll: ResolveAll = defaultResolveAll,
): Promise<UrlValidation> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Please enter a website address.' };

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn't look like a valid website address." };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only website addresses starting with http:// or https:// can be checked.' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Website addresses containing a username or password cannot be checked.' };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, error: 'Only websites on the standard ports (80 and 443) can be checked.' };
  }

  const host = bareHostname(url.hostname);
  if (!host) return { ok: false, error: "That doesn't look like a valid website address." };
  if (isLocalhostName(host)) {
    return { ok: false, error: 'Local addresses cannot be checked. Please enter a public website.' };
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      return { ok: false, error: 'Private or internal network addresses cannot be checked. Please enter a public website.' };
    }
  } else {
    let addresses;
    try {
      addresses = await resolveAll(host);
    } catch {
      return { ok: false, error: "We couldn't find that website. Please check the address." };
    }
    if (addresses.length === 0) {
      return { ok: false, error: "We couldn't find that website. Please check the address." };
    }
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return { ok: false, error: 'That address points to a private or internal network and cannot be checked.' };
    }
  }

  return { ok: true, url: `${url.origin}/` };
}
