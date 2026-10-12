import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateAddress, isInSubnets, isVpnCandidate, stripVpnCandidates, vpnSubnetsOf } from './vpnRoutes.ts';

// The adapters of the PC the problem was seen on.
const adapters = {
  'Ethernet': [{ address: '192.168.1.100', cidr: '192.168.1.100/24', family: 'IPv4' }],
  'Ethernet 2': [{ address: '172.20.10.11', cidr: '172.20.10.11/28', family: 'IPv4' }],
  'ZeroTier One [a84ac5c10af4b655]': [
    { address: '192.168.192.199', cidr: '192.168.192.199/24', family: 'IPv4' },
    { address: 'fd80:56c2:e21c:0:199:93a8:4bc5:1f2e', cidr: 'fd80:56c2:e21c:0:199:93a8:4bc5:1f2e/88', family: 'IPv6' },
  ],
  'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', cidr: '127.0.0.1/8', family: 'IPv4' }],
};
const subnets = vpnSubnetsOf(adapters);
const cand = (ip, typ = 'host') => `candidate:1 1 UDP 2122317823 ${ip} 53211 typ ${typ}`;

test('only the VPN adapter contributes subnets', () => {
  assert.equal(subnets.length, 2);
  assert.equal(isInSubnets('192.168.192.199', subnets), true);
  assert.equal(isInSubnets('192.168.1.100', subnets), false);
  assert.equal(isInSubnets('172.20.10.11', subnets), false);
});

test('the peer on the same overlay is recognised, a real LAN and the internet are not', () => {
  assert.equal(isVpnCandidate(cand('192.168.192.57'), subnets), true);          // the other PC's ZeroTier address
  assert.equal(isVpnCandidate(cand('192.168.1.23'), subnets), false);            // same-office LAN
  assert.equal(isVpnCandidate(cand('203.0.113.9', 'srflx') + ' raddr 0.0.0.0 rport 0', subnets), false);
  assert.equal(isVpnCandidate(cand('fd80:56c2:e21c:0:199:93aa:aaaa:bbbb'), subnets), true);
  assert.equal(isVpnCandidate(cand('2001:db8::1'), subnets), false);
  assert.equal(isVpnCandidate(cand('a1b2c3d4-0000-4000-8000-123456789abc.local'), subnets), false);
});

test('candidate address parsing copes with the a= prefix form and junk', () => {
  assert.equal(candidateAddress('a=candidate:1 1 UDP 2122317823 10.1.2.3 5000 typ host'), '10.1.2.3');
  assert.equal(candidateAddress('not a candidate'), '');
  assert.equal(candidateAddress(''), '');
});

test('SDP keeps everything except VPN candidate lines, and its line endings', () => {
  const sdp = ['v=0', 'm=video 9 UDP/TLS/RTP/SAVPF 96', `a=${cand('192.168.192.199')}`, `a=${cand('192.168.1.100')}`, 'a=end-of-candidates', ''].join('\r\n');
  const out = stripVpnCandidates(sdp, subnets);
  assert.ok(!out.includes('192.168.192.199'));
  assert.ok(out.includes('192.168.1.100'));
  assert.ok(out.includes('a=end-of-candidates'));
  assert.equal(out.split('\r\n').length, sdp.split('\r\n').length - 1);
});

test('a machine with no VPN adapter is left completely alone', () => {
  const none = vpnSubnetsOf({ Ethernet: adapters.Ethernet });
  assert.equal(none.length, 0);
  const sdp = `a=${cand('192.168.192.199')}\r\n`;
  assert.equal(stripVpnCandidates(sdp, none), sdp);
  assert.equal(isVpnCandidate(cand('192.168.192.199'), none), false);
});

test('adapter names: ZeroTier, Tailscale, WireGuard and OpenVPN TAP match; ordinary ones do not', () => {
  const names = (n) => vpnSubnetsOf({ [n]: [{ address: '10.9.0.2', cidr: '10.9.0.2/24', family: 'IPv4' }] }).length;
  for (const n of ['ZeroTier One [abc]', 'Tailscale', 'wg0', 'WireGuard Tunnel', 'OpenVPN TAP-Windows6', 'ztabcdef12', 'utun3']) assert.equal(names(n), 1, n);
  for (const n of ['Ethernet', 'Wi-Fi', 'vEthernet (Default Switch)', 'Bluetooth Network Connection']) assert.equal(names(n), 0, n);
});
