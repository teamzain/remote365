// Demo backend for App Store screenshots of the iOS app.
//
// The screenshot build talks to http://localhost:4000 (eas.json profile
// "ios-screenshots"), so the store images show a fictional company with neutral
// data instead of any real customer, and no real account or password is used.
// Every request is logged so missing endpoints are easy to spot in the CI log.
//
// node scripts/app-store-screenshots/mock-api.mjs   (no dependencies)

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 4000);
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const user = {
  id: '6f0f4c2a-6a8e-4c39-9d6b-2f5d8f0a1b11',
  email: 'alex@northwind.example',
  name: 'Alex Morgan',
  role: 'OWNER',
  organizationId: 'org-northwind',
  organization: { id: 'org-northwind', name: 'Northwind IT', accountType: 'BUSINESS' },
  is2FAEnabled: true,
  allowedDeviceIds: ['__all__'],
  avatarUrl: null,
};

const groups = [
  { id: 'g-office', name: 'Head Office', color: '#FF8A00' },
  { id: 'g-support', name: 'Support Desk', color: '#2563EB' },
  { id: 'g-field', name: 'Field Laptops', color: '#12B76A' },
  { id: 'g-servers', name: 'Servers', color: '#7C3AED' },
];

let k = 100_200_300;
const device = (name, opts = {}) => ({
  id: `d-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  device_name: name,
  access_key: String(k += 7_331_019),
  is_online: opts.online ?? true,
  in_session: opts.session ?? false,
  is_owned: true,
  device_type: 'windows',
  last_seen_at: opts.online === false ? iso(opts.seen ?? 3 * HOUR) : iso(MIN),
  device_groups: (opts.groups || []).map((id) => groups.find((g) => g.id === id)),
});

const devices = [
  device('Reception-PC', { groups: ['g-office'] }),
  device('Finance-Laptop', { groups: ['g-office'], session: true }),
  device('Design-Workstation', { groups: ['g-office'] }),
  device('Boardroom-Display', { groups: ['g-office'], online: false, seen: 2 * DAY }),
  device('HR-Desktop', { groups: ['g-office'] }),
  device('Accounts-PC-02', { groups: ['g-office'], online: false, seen: 5 * HOUR }),
  device('Helpdesk-01', { groups: ['g-support'], session: true }),
  device('Helpdesk-02', { groups: ['g-support'] }),
  device('Helpdesk-03', { groups: ['g-support'] }),
  device('Training-Room', { groups: ['g-support'], online: false, seen: 1 * DAY }),
  device('Sales-Laptop-Emma', { groups: ['g-field'] }),
  device('Sales-Laptop-Jonah', { groups: ['g-field'], online: false, seen: 40 * MIN }),
  device('Site-Survey-Tablet', { groups: ['g-field'] }),
  device('File-Server', { groups: ['g-servers'] }),
  device('Backup-Server', { groups: ['g-servers'] }),
  device('Alex-Home-PC', {}),
  device('Alex-Laptop', {}),
];

const groupPayload = {
  groups: groups.map((g) => {
    const ids = devices.filter((d) => d.device_groups.some((x) => x.id === g.id)).map((d) => d.id);
    return { ...g, deviceIds: ids, deviceCount: ids.length };
  }),
};

const person = (id, name, email) => ({ userId: id, user: { id, name, email } });
const me = person(user.id, user.name, user.email);
const conversations = [
  { id: 'c1', isGroup: false, participants: [me, person('u-priya', 'Priya Shah', 'priya@northwind.example')], otherOnline: true, unreadCount: 2, updatedAt: iso(4 * MIN), messages: [{ content: 'Finance laptop is back online, thanks for the quick fix!' }] },
  { id: 'c2', isGroup: true, name: 'Support Desk', participants: [me, person('u-dan', 'Daniel Kim', 'daniel@northwind.example'), person('u-lena', 'Lena Fischer', 'lena@northwind.example')], unreadCount: 0, updatedAt: iso(35 * MIN), messages: [{ content: 'Daniel: Printer driver rolled out to all helpdesk PCs.' }] },
  { id: 'c3', isGroup: false, participants: [me, person('u-marco', 'Marco Rossi', 'marco@northwind.example')], otherOnline: false, unreadCount: 0, updatedAt: iso(3 * HOUR), messages: [{ content: 'Can you connect to the boardroom display before 2 pm?' }] },
  { id: 'c4', isGroup: false, participants: [me, person('u-sofia', 'Sofia Alvarez', 'sofia@northwind.example')], otherOnline: true, unreadCount: 0, updatedAt: iso(1 * DAY), messages: [{ content: 'VPN works now. Have a great weekend!' }] },
  { id: 'c5', isGroup: true, name: 'Head Office', participants: [me, person('u-priya', 'Priya Shah', 'priya@northwind.example'), person('u-marco', 'Marco Rossi', 'marco@northwind.example')], unreadCount: 0, updatedAt: iso(2 * DAY), messages: [{ content: 'Marco: Windows updates are scheduled for Friday night.' }] },
];

const meetings = [
  { id: 'm1', name: 'Daily IT stand-up', sessionCode: '482 913 557', displayCode: '482 913 557', status: 'ACTIVE', variant: 'instant', createdAt: iso(10 * MIN), expiresAt: new Date(now + 2 * HOUR).toISOString(), createdBy: { id: user.id, name: user.name } },
  { id: 'm2', name: 'Laptop rollout review', sessionCode: '730 118 264', displayCode: '730 118 264', status: 'SCHEDULED', variant: 'later', createdAt: iso(2 * HOUR), expiresAt: new Date(now + DAY).toISOString(), createdBy: { id: 'u-priya', name: 'Priya Shah' } },
  { id: 'm3', name: 'Quarterly security check', sessionCode: '915 640 382', displayCode: '915 640 382', status: 'SCHEDULED', variant: 'calendar', createdAt: iso(DAY), expiresAt: new Date(now + 3 * DAY).toISOString(), createdBy: { id: user.id, name: user.name } },
];

let plans = null;
async function loadPlans() {
  try {
    const res = await fetch('https://remote365.ai/api/billing/plans');
    plans = await res.json();
    console.log('[mock] plans loaded from remote365.ai');
  } catch (err) {
    plans = { plans: [] };
    console.log('[mock] could not load plans:', err.message);
  }
}

const tokens = { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', expiresIn: 86_400, sessionId: 'demo-session', user };

function route(method, path) {
  if (path === '/api/auth/login' || path === '/api/auth/refresh' || path === '/api/auth/apple') return tokens;
  if (path === '/api/auth/me') return user;
  if (path === '/api/devices/mine') return devices;
  if (path === '/api/devices/user-groups') return groupPayload;
  if (path === '/api/chat/conversations') return conversations;
  if (path === '/api/chat/meetings') return meetings;
  if (path === '/api/chat/session-invites') return [];
  if (path === '/api/billing/plans') return plans;
  if (path === '/api/billing/current') return { plan: 'PRO', status: 'ACTIVE', currentPeriodEnd: new Date(now + 20 * DAY).toISOString() };
  if (path === '/api/auth/sessions') return [];
  if (path === '/api/auth/ice-servers') return { iceServers: [] };
  if (path.startsWith('/api/chat/conversations/') && path.endsWith('/messages')) return [];
  return null;
}

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  let body = route(req.method, path);
  const known = body !== null;
  if (!known) body = req.method === 'GET' ? [] : { ok: true };
  console.log(`[mock] ${req.method} ${req.url} -> ${known ? 'demo' : 'default'}`);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
});

// Accept the realtime WebSocket (/api/signal) and keep it quietly open, so the app
// does not show a connection error in the screenshots.
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  console.log(`[mock] websocket ${req.url}`);
  socket.on('data', (buf) => {
    // Answer pings (opcode 0x9) with a pong so the client keeps the socket.
    if ((buf[0] & 0x0f) === 0x9) socket.write(Buffer.from([0x8a, 0x00]));
  });
  socket.on('error', () => {});
});

await loadPlans();
server.listen(PORT, () => console.log(`[mock] listening on http://localhost:${PORT}`));
