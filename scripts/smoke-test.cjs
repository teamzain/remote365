// Backend smoke test — run through scripts/local-smoke.sh (npm run test:smoke),
// which starts the stack and seeds the owner account this logs in with.
//
//   node scripts/smoke-test.cjs <ownerEmail> <ownerPassword>
//
// Every request goes through Caddy at http://localhost:8088 (override with
// SMOKE_BASE_URL), the same path real clients use. Checks tagged [repo-only]
// cover behaviour not yet deployed to preprod; [from preprod] and [preprod gate
// kept] cover preprod behaviour this repo must preserve. Needs Node 22+ for the
// built-in fetch and WebSocket.
const crypto = require('crypto');
const { execSync } = require('child_process');

if (typeof WebSocket === 'undefined') {
  console.error('Node 22 or newer is required (built-in WebSocket).');
  process.exit(1);
}

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8088';
const WS_URL = BASE.replace(/^http/, 'ws') + '/api/signal';
const [OWNER_EMAIL, OWNER_PASSWORD] = process.argv.slice(2);
// Set by local-smoke.sh; used to promote the test user for the admin console check.
const COMPOSE = process.env.COMPOSE_CMD;

if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Usage: node scripts/smoke-test.cjs <ownerEmail> <ownerPassword>');
  process.exit(1);
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function api(method, url, { token, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// Registers a host on the signaling server the way the desktop app does and
// resolves with the server's answer ('registered' or 'registration-error').
function registerHost(accessKey) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => done({ type: 'timeout' }), 10000);
    function done(result) {
      clearTimeout(timer);
      resolve({ close: () => ws.close(), ...result });
    }
    ws.addEventListener('open', () => ws.send(JSON.stringify({
      type: 'register', accessKey, clientKind: 'host', appVersion: 'smoke', platform: 'win32',
    })));
    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (msg.type === 'registered' || msg.type === 'registration-error') done(msg);
    });
    ws.addEventListener('error', () => done({ type: 'error', error: 'WebSocket error' }));
  });
}

const hex = (n) => crypto.randomBytes(n).toString('hex');
const short = (d) => (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 120);
const created = (r) => r.status === 200 || r.status === 201;
const hostResult = (h) => `${h.type} ${h.sessionId || h.error || ''}`;

async function main() {
  // Services reachable through Caddy
  let r = await api('GET', '/api/auth/health');
  check('auth-service health via Caddy', r.status === 200, `${r.status} ${short(r.data)}`);
  r = await api('GET', '/api/sessions/health');
  check('session-service health via Caddy', r.status === 200, `${r.status} ${short(r.data)}`);
  r = await api('GET', '/api/billing/plans');
  const plans = Array.isArray(r.data) ? r.data : (r.data?.plans || []);
  check('billing-service plans via Caddy', r.status === 200 && plans.length > 0, `${r.status}, ${plans.length} plans`);

  // Sign-in
  r = await api('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: 'wrong-password' } });
  check('login with wrong password is refused', r.status === 401, `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
  let token = r.data?.accessToken;
  check('login with seeded owner account', r.status === 200 && token, `${r.status} plan=${r.data?.user?.plan}`);
  if (!token) return;
  r = await api('GET', '/api/auth/me', { token });
  check('/api/auth/me returns the signed-in user', r.status === 200 && JSON.stringify(r.data).includes(OWNER_EMAIL), `${r.status}`);

  // Devices + signaling
  const devicePassword = 'Smoke-' + hex(4);
  r = await api('POST', '/api/devices/self-register', {
    body: { name: 'Smoke PC ' + hex(2), password: devicePassword, deviceType: 'WINDOWS', fingerprint: hex(16) },
  });
  const accessKey = r.data?.access_key;
  check('desktop host self-registers', created(r) && accessKey, `${r.status} key=${accessKey}`);
  if (!accessKey) return;

  let host = await registerHost(accessKey);
  check('host registers on signaling WebSocket (via Caddy)', host.type === 'registered', hostResult(host));
  r = await api('POST', '/api/devices/verify-access', { token, body: { accessKey, password: devicePassword } });
  check('viewer verify-access with correct password', r.status === 200, `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/devices/verify-access', { token, body: { accessKey, password: 'nope' } });
  check('viewer verify-access with wrong password is refused', r.status === 401 || r.status === 403, `${r.status} ${short(r.data)}`);
  host.close();

  r = await api('POST', '/api/devices/add-existing', { token, body: { accessKey, password: devicePassword, claimOwnership: true } });
  check('owner adds and claims the device', created(r), `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/devices/add-existing', { token, body: { accessKey, password: devicePassword } });
  check('[repo-only] adding the same device again → 409', r.status === 409, `${r.status} ${short(r.data)}`);
  r = await api('GET', '/api/devices', { token });
  check('device appears in the owner\'s device list', r.status === 200 && JSON.stringify(r.data).includes(accessKey), `${r.status}`);

  host = await registerHost(accessKey);
  check('[preprod gate kept] owned host without token still registers', host.type === 'registered', hostResult(host));
  host.close();

  r = await api('POST', '/api/devices/self-register', { body: { name: 'Smoke Phone', deviceType: 'ANDROID', fingerprint: hex(16) } });
  check('[repo-only] Android self-register without host credential → 400', r.status === 400, `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/devices/self-register', { body: { name: 'Smoke Phone', deviceType: 'ANDROID', fingerprint: hex(16), hostSecret: hex(32) } });
  check('[repo-only] Android self-register with host credential', created(r) && r.data?.access_key, `${r.status} key=${r.data?.access_key}`);

  // Organization groups
  const groupName = 'Smoke Sales ' + hex(2);
  r = await api('POST', '/api/groups', { token, body: { name: groupName } });
  check('create device group', created(r), `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/groups', { token, body: { name: groupName.toLowerCase() } });
  check('[repo-only] same group name, different case → 409', r.status === 409, `${r.status} ${short(r.data)}`);

  // Chat, sessions, support
  r = await api('GET', '/api/chat/conversations', { token });
  check('chat conversations list', r.status === 200, `${r.status}`);
  r = await api('GET', '/api/sessions', { token });
  check('session-service: list support sessions', r.status === 200, `${r.status}`);
  const contactEmail = `smoke-${hex(3)}@example.com`;
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const c = await api('POST', '/api/support/contact', { body: { name: 'Smoke', email: contactEmail, message: 'smoke test ' + i } });
    codes.push(c.status);
  }
  check('[from preprod] contact form rate limit: 6th message → 429', codes[5] === 429 && !codes.slice(0, 5).includes(429), codes.join(','));

  // Google Play routes must reach auth-service, not billing-service (Caddyfile)
  r = await api('POST', '/api/billing/google-play/verify', { body: {} });
  check('google-play/verify without login → 401 from auth-service', r.status === 401, `${r.status} ${short(r.data)}`);
  r = await api('POST', '/api/billing/google-play/verify', { token, body: { purchaseToken: 'bogus', productId: 'bogus' } });
  check('google-play/verify signed in → handled, not 404', r.status !== 404, `${r.status} ${short(r.data)}`);

  // Super admin console
  r = await api('GET', '/api/admin/overview', { token });
  check('admin console refuses an org owner', r.status === 403 || r.status === 401, `${r.status}`);
  if (COMPOSE) {
    execSync(`${COMPOSE} exec -T postgres psql -U remotelink -d remotelink -qc "UPDATE \\"User\\" SET role='SUPER_ADMIN' WHERE email='${OWNER_EMAIL}';"`, { stdio: 'ignore' });
    r = await api('POST', '/api/auth/login', { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
    token = r.data?.accessToken;
    r = await api('GET', '/api/admin/overview', { token });
    check('admin console overview as super admin', r.status === 200, `${r.status} ${short(r.data)}`);
  }
}

main()
  .catch((err) => check('smoke test crashed', false, err.stack))
  .finally(() => {
    const failed = results.filter((x) => !x.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exit(failed.length ? 1 : 0);
  });
