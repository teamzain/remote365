// Keep remote sessions off VPN overlay networks (ZeroTier, Tailscale, ...).
//
// ICE ranks "host" candidates (addresses of local network adapters) above
// everything else, and a VPN adapter looks exactly like a local network. Two
// machines that are both on the same ZeroTier network therefore pair over the
// tunnel even when the plain internet path between them is as fast or faster.
// The tunnel is a second hop with its own path changes: field log, Oct 4 2026,
// a healthy session (0% loss, 30 fps) on a host<->host route with a 180 ms
// round trip — a "LAN" at 180 ms is a tunnel — was cut dead mid-stream and
// had spent a minute at +100 ms just before.
//
// So candidates that belong to a VPN adapter's subnet are dropped on both
// sides: ours before they are sent, the peer's before they are used. Both ends
// of an overlay share its subnet, which is what makes the peer's recognisable.
// Real LAN candidates are untouched.

export interface AdapterAddress { address: string; netmask?: string; cidr?: string | null; family: string | number }
export type AdapterMap = Record<string, AdapterAddress[] | undefined>;

const VPN_ADAPTER = /zerotier|tailscale|wireguard|wintun|openvpn|tap-windows|hamachi|nordlynx|\bvpn\b|^zt[a-z0-9]|^tun\d|^utun\d|^wg\d|^tap\d/i;

export interface Subnet { family: 4 | 6; bytes: number[]; prefix: number }

const parseV4 = (ip: string): number[] | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => Number(p));
  return bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255) ? bytes : null;
};

const parseV6 = (ip: string): number[] | null => {
  const clean = ip.split('%')[0];
  if (!clean.includes(':')) return null;
  const [head, tail] = clean.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail !== undefined && tail !== '' ? tail.split(':') : [];
  if (clean.includes('::')) {
    if (headGroups.length + tailGroups.length > 7) return null;
  } else if (headGroups.length !== 8) return null;
  const fill = clean.includes('::') ? new Array(8 - headGroups.length - tailGroups.length).fill('0') : [];
  const groups = [...headGroups, ...fill, ...tailGroups];
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push(v >> 8, v & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
};

const parseIp = (ip: string): { family: 4 | 6; bytes: number[] } | null => {
  const v4 = parseV4(ip);
  if (v4) return { family: 4, bytes: v4 };
  const v6 = parseV6(ip);
  return v6 ? { family: 6, bytes: v6 } : null;
};

/** Subnets of every adapter that looks like a VPN overlay. */
export function vpnSubnetsOf(adapters: AdapterMap): Subnet[] {
  const subnets: Subnet[] = [];
  for (const [name, addresses] of Object.entries(adapters)) {
    if (!VPN_ADAPTER.test(name) || !addresses) continue;
    for (const entry of addresses) {
      const ip = parseIp(entry.address);
      if (!ip) continue;
      // fe80::/10 is link-local: every adapter has one in the same range, so
      // treating the VPN adapter's as "the VPN subnet" would match them all.
      if (ip.family === 6 && ip.bytes[0] === 0xfe && (ip.bytes[1] & 0xc0) === 0x80) continue;
      const fromCidr = entry.cidr ? Number(String(entry.cidr).split('/')[1]) : NaN;
      const prefix = Number.isInteger(fromCidr) ? fromCidr : (ip.family === 4 ? 24 : 64);
      subnets.push({ family: ip.family, bytes: ip.bytes, prefix });
    }
  }
  return subnets;
}

export function isInSubnets(address: string, subnets: Subnet[]): boolean {
  const ip = parseIp(address);
  if (!ip) return false;
  return subnets.some((net) => {
    if (net.family !== ip.family) return false;
    let bits = net.prefix;
    for (let i = 0; i < net.bytes.length && bits > 0; i++) {
      const take = Math.min(8, bits);
      const mask = (0xff << (8 - take)) & 0xff;
      if ((net.bytes[i] & mask) !== (ip.bytes[i] & mask)) return false;
      bits -= take;
    }
    return true;
  });
}

/** The connection address inside an ICE candidate line, or '' if there is none. */
export function candidateAddress(candidate: string): string {
  // candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...
  const m = /candidate:\S+\s+\d+\s+\S+\s+\d+\s+(\S+)\s+\d+\s+typ\s/i.exec(candidate || '');
  return m ? m[1] : '';
}

export function isVpnCandidate(candidate: string, subnets: Subnet[]): boolean {
  if (subnets.length === 0) return false;
  const address = candidateAddress(candidate);
  return address !== '' && isInSubnets(address, subnets);
}

/** Remove a=candidate lines on a VPN subnet from an SDP blob. */
export function stripVpnCandidates(sdp: string, subnets: Subnet[]): string {
  if (!sdp || subnets.length === 0) return sdp;
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  return sdp.split(/\r?\n/).filter((line) => !(line.startsWith('a=candidate:') && isVpnCandidate(line.slice(2), subnets))).join(eol);
}
