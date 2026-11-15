import { BlockList, isIP } from 'node:net';

/**
 * Private, loopback, link-local, multicast, documentation and otherwise
 * reserved ranges. Anything in here must never be fetched by SiteLens.
 * Sources: IANA IPv4/IPv6 Special-Purpose Address Registries.
 */
const IPV4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (cloud metadata lives here)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // deprecated 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes 255.255.255.255 broadcast
];

const IPV6_BLOCKED: [string, number][] = [
  ['::', 96], // unspecified (::), loopback (::1), deprecated IPv4-compatible
  ['::ffff:0:0:0', 96], // SIIT IPv4-translated
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard-only
  ['2001::', 23], // IETF protocol assignments (Teredo, benchmarking, ORCHID, ...)
  ['2001:db8::', 32], // documentation
  ['3fff::', 20], // documentation (RFC 9637)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // deprecated site-local
  ['ff00::', 8], // multicast
];

const blockList = new BlockList();
for (const [net, prefix] of IPV4_BLOCKED) blockList.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of IPV6_BLOCKED) blockList.addSubnet(net, prefix, 'ipv6');

/** Expand an IPv6 address (validated by `isIP`) into eight 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  let s = ip;
  const tail: number[] = [];
  // Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) becomes two groups.
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2].split('.').map(Number);
    tail.push((a << 8) | b, (c << 8) | d);
    s = dotted[1].endsWith('::') ? dotted[1] : dotted[1].slice(0, -1);
  }
  const [head, rest] = s.split('::');
  const parse = (part: string | undefined) => (part ? part.split(':').filter(Boolean).map((h) => parseInt(h, 16)) : []);
  const left = parse(head);
  const right = [...parse(rest), ...tail];
  if (rest === undefined) return [...left, ...tail];
  const zeros = new Array(8 - left.length - right.length).fill(0);
  return [...left, ...zeros, ...right];
}

function v4FromGroups(hi: number, lo: number): string {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

/** IPv4 addresses embedded in IPv6 forms that route to IPv4 hosts. */
function embeddedIPv4(groups: number[]): string | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  // ::ffff:0:0/96 IPv4-mapped
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return v4FromGroups(g6, g7);
  // 64:ff9b::/96 well-known NAT64 prefix
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return v4FromGroups(g6, g7);
  // 2002::/16 6to4
  if (g0 === 0x2002) return v4FromGroups(g1, g2);
  return null;
}

/**
 * True if `ip` is private, loopback, link-local, multicast, documentation or
 * otherwise reserved — or is not a valid IP address at all (fails closed).
 * Accepts bracketed IPv6 (`[::1]`) and zone ids (`fe80::1%en0`).
 */
export function isPrivateAddress(ip: string): boolean {
  let addr = ip.trim();
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1);
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);

  const family = isIP(addr);
  if (family === 4) return blockList.check(addr, 'ipv4');
  if (family === 6) {
    const groups = ipv6Groups(addr);
    if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return true;
    const v4 = embeddedIPv4(groups);
    if (v4 !== null && blockList.check(v4, 'ipv4')) return true;
    return blockList.check(addr, 'ipv6');
  }
  return true; // not an IP: never treat as safe
}
