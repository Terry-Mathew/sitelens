import { describe, it, expect } from 'vitest';
import { isPrivateAddress } from '@/lib/security/ip';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700::1111'])('%s is public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it.each([
    // IPv4 special-purpose ranges
    '0.1.2.3', // 0.0.0.0/8
    '10.255.255.255', // 10/8
    '100.127.255.254', // 100.64/10
    '127.255.255.255', // 127/8
    '169.254.0.1', // 169.254/16
    '172.31.255.255', // 172.16/12
    '192.0.0.8', // 192.0.0/24
    '192.0.2.1', // 192.0.2/24 TEST-NET-1
    '192.168.255.255', // 192.168/16
    '198.18.0.1', // 198.18/15
    '198.19.255.255', // 198.18/15
    '198.51.100.7', // TEST-NET-2
    '203.0.113.9', // TEST-NET-3
    '224.0.0.1', // multicast
    '239.255.255.255', // multicast
    '240.0.0.1', // reserved
    '255.255.255.255', // broadcast
    // IPv6
    '::', // unspecified
    '0:0:0:0:0:0:0:1', // loopback, long form
    'fd12:3456::1', // ULA fc00::/7
    'febf::1', // fe80::/10
    'ff02::1', // multicast
    '2001:db8::1', // documentation
    '64:ff9b::7f00:1', // NAT64 embedding 127.0.0.1
    '64:ff9b::a00:1', // NAT64 embedding 10.0.0.1
    '::ffff:7f00:1', // IPv4-mapped 127.0.0.1 (WHATWG-serialised form)
    '::ffff:10.0.0.1', // IPv4-mapped 10.0.0.1
    '::ffff:169.254.169.254', // IPv4-mapped metadata
    '[::1]', // bracketed
    'fe80::1%en0', // zone id
  ])('%s is private/reserved', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '172.32.0.1', '100.128.0.1', '198.20.0.1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2a00:1450:4009:81f::200e'])(
    '%s is public',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it.each(['', 'example.com', 'localhost', '999.1.1.1', 'not an ip', '1.2.3'])(
    'fails closed for non-IP input %j',
    (value) => {
      expect(isPrivateAddress(value)).toBe(true);
    },
  );
});
