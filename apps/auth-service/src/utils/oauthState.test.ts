import assert from 'node:assert/strict';
import {
  allowedWebOrigins,
  decodeOauthState,
  encodeOauthState,
  localReturnUrlsAllowed,
  normalizePlatform,
  validateReturnUrl,
} from './oauthState';

// Env of the two live deployments (only the keys the allowlist reads).
const PREPROD = {
  PUBLIC_WEB_URL: 'https://pp.remote365.ai',
  DOMAIN: 'pp.remote365.ai',
  CADDY_SITE: 'pp.remote365.ai, :80',
  JWT_SECRET: 'preprod-secret',
};
const PROD = {
  WEB_APP_URL: 'https://remote365.ai',
  DOMAIN: '159.65.84.190',
  JWT_SECRET: 'prod-secret',
};

// ── Allowed origins ──────────────────────────────────────────────────────
assert.deepEqual([...allowedWebOrigins(PREPROD)].sort(), ['https://pp.remote365.ai']);
assert.deepEqual([...allowedWebOrigins(PROD)].sort(), ['https://remote365.ai', 'https://www.remote365.ai']);
assert.deepEqual(
  [...allowedWebOrigins({ CADDY_SITE: 'remote365.ai, www.remote365.ai, :80' })].sort(),
  ['https://remote365.ai', 'https://www.remote365.ai'],
);
assert.deepEqual(
  [...allowedWebOrigins({ ...PREPROD, OAUTH_RETURN_ORIGINS: 'https://staging.remote365.ai' })].sort(),
  ['https://pp.remote365.ai', 'https://staging.remote365.ai'],
);
// Nothing configured: the default site.
assert.deepEqual([...allowedWebOrigins({})].sort(), ['https://remote365.ai', 'https://www.remote365.ai']);

// Loopback (local web development): on for preprod and unconfigured backends,
// off for the production site, explicit flag wins.
assert.equal(localReturnUrlsAllowed(PREPROD), true);
assert.equal(localReturnUrlsAllowed({}), true);
assert.equal(localReturnUrlsAllowed(PROD), false);
assert.equal(localReturnUrlsAllowed({ ...PROD, OAUTH_ALLOW_LOCAL_RETURN_URLS: 'true' }), true);
assert.equal(localReturnUrlsAllowed({ ...PREPROD, OAUTH_ALLOW_LOCAL_RETURN_URLS: 'false' }), false);

// ── Web returnUrls ───────────────────────────────────────────────────────
const web = (value: unknown, env: Record<string, string> = PREPROD) => validateReturnUrl('web', value, env);

assert.equal(web('https://pp.remote365.ai/auth/callback'), 'https://pp.remote365.ai/auth/callback');
assert.equal(web('https://pp.remote365.ai:443/auth/callback'), 'https://pp.remote365.ai/auth/callback');
assert.equal(web('https://PP.Remote365.ai/auth/callback?x=1#y'), 'https://pp.remote365.ai/auth/callback');
assert.equal(web('https://remote365.ai/auth/callback', PROD), 'https://remote365.ai/auth/callback');
assert.equal(web('https://www.remote365.ai/auth/callback', PROD), 'https://www.remote365.ai/auth/callback');
assert.equal(web('http://localhost:5175/auth/callback'), 'http://localhost:5175/auth/callback');
assert.equal(web('http://127.0.0.1:3000/auth/callback'), 'http://127.0.0.1:3000/auth/callback');
assert.equal(web('http://[::1]:5173/auth/callback'), 'http://[::1]:5173/auth/callback');

const refusedWeb: Array<[string, Record<string, string>?]> = [
  ['https://attacker.example/cb'],
  ['https://attacker.example/auth/callback'],
  ['https://pp.remote365.ai.attacker.example/auth/callback'],
  ['https://attacker.example/auth/callback?next=https://pp.remote365.ai'],
  ['https://pp.remote365.ai@attacker.example/auth/callback'],
  ['https://user:pass@pp.remote365.ai/auth/callback'],
  ['https://pp.remote365.ai\\@attacker.example/auth/callback'],
  ['//attacker.example/auth/callback'],
  ['http://pp.remote365.ai/auth/callback'],           // plain http
  ['https://pp.remote365.ai/dashboard'],              // not the callback page
  ['https://pp.remote365.ai/auth/callback/'],
  ['https://remote365.ai/auth/callback'],             // prod origin on preprod
  ['https://pp.remote365.ai/auth/callback', PROD],    // preprod origin on prod
  ['http://localhost:5175/auth/callback', PROD],      // loopback on prod
  ['http://localhost.attacker.example/auth/callback'],
  ['http://127.0.0.2/auth/callback'],
  ['javascript:alert(document.cookie)'],
  ['data:text/html,hi'],
  ['remote365://auth/callback'],                      // mobile scheme on web
  ['https://159.65.84.190/auth/callback', PROD],
  ['https://pp.remote365.ai/auth/callback' + 'x'.repeat(3000)],
];
for (const [value, env] of refusedWeb) {
  assert.equal(web(value, env), undefined, `web returnUrl should be refused: ${value.slice(0, 80)}`);
}
assert.equal(web(undefined), undefined);
assert.equal(web(''), undefined);
assert.equal(web(['https://pp.remote365.ai/auth/callback']), undefined);

// ── Mobile returnUrls: only the app's own schemes ───────────────────────
assert.equal(validateReturnUrl('mobile', 'remote365://auth/callback', PREPROD), 'remote365://auth/callback');
assert.equal(validateReturnUrl('mobile', 'remotelink://auth/callback', PREPROD), 'remotelink://auth/callback');
assert.equal(validateReturnUrl('mobile', 'remote365://auth/callback#frag', PREPROD), 'remote365://auth/callback');
for (const value of [
  'https://attacker.example/cb',
  'https://pp.remote365.ai/auth/callback',
  'exp://attacker.example/--/auth/callback',
  'intent://auth/callback#Intent;scheme=remote365;end',
  'javascript:alert(1)',
  'http://localhost:8081/auth/callback',
]) {
  assert.equal(validateReturnUrl('mobile', value, PREPROD), undefined, `mobile returnUrl should be refused: ${value}`);
}

// ── Desktop never takes a returnUrl ─────────────────────────────────────
assert.equal(validateReturnUrl('desktop', 'remote365://auth/callback', PREPROD), undefined);
assert.equal(validateReturnUrl('desktop', 'https://pp.remote365.ai/auth/callback', PREPROD), undefined);

assert.equal(normalizePlatform('desktop'), 'desktop');
assert.equal(normalizePlatform('mobile'), 'mobile');
assert.equal(normalizePlatform('web'), 'web');
assert.equal(normalizePlatform('evil'), 'web');
assert.equal(normalizePlatform(undefined), 'web');

// ── Signed state ─────────────────────────────────────────────────────────
const now = Date.UTC(2026, 8, 26, 12, 0, 0);
const issued = encodeOauthState(
  { platform: 'web', returnUrl: 'https://pp.remote365.ai/auth/callback', accountType: 'business', handoff: 'code' },
  PREPROD,
  now,
);
assert.deepEqual(decodeOauthState(issued, PREPROD, now + 60_000), {
  platform: 'web',
  returnUrl: 'https://pp.remote365.ai/auth/callback',
  accountType: 'business',
  handoff: 'code',
});

const [payload, signature] = issued.split('.');
const tamperedPayload = Buffer.from(
  JSON.stringify({ platform: 'web', returnUrl: 'https://attacker.example/auth/callback', iat: now }),
).toString('base64url');
const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);

assert.equal(decodeOauthState(`${tamperedPayload}.${signature}`, PREPROD, now), null, 'altered payload');
assert.equal(decodeOauthState(`${payload}.${flip(signature)}`, PREPROD, now), null, 'altered signature');
assert.equal(decodeOauthState(issued, PROD, now), null, 'signed with another secret');
assert.equal(decodeOauthState(issued, PREPROD, now + 31 * 60_000), null, 'expired');
assert.equal(decodeOauthState(issued, PREPROD, now - 5 * 60_000), null, 'issued in the future');
// The old unsigned format, as an attacker would forge it.
assert.equal(decodeOauthState(tamperedPayload, PREPROD, now), null, 'unsigned legacy state');
assert.equal(decodeOauthState('desktop', PREPROD, now), null, 'bare platform string');
assert.equal(decodeOauthState(undefined, PREPROD, now), null);
assert.equal(decodeOauthState('', PREPROD, now), null);
assert.equal(decodeOauthState(`${payload}.${signature}.x`, PREPROD, now), null);

// A validly signed state still has its returnUrl re-checked (e.g. the
// allowlist changed while the user was at the provider).
const signedForeign = encodeOauthState({ platform: 'web', returnUrl: 'https://attacker.example/auth/callback' }, PREPROD, now);
assert.deepEqual(decodeOauthState(signedForeign, PREPROD, now), {
  platform: 'web',
  returnUrl: undefined,
  accountType: undefined,
  handoff: undefined,
});
// handoff is a web-only option.
const mobileState = encodeOauthState({ platform: 'mobile', returnUrl: 'remote365://auth/callback', handoff: 'code' }, PREPROD, now);
assert.deepEqual(decodeOauthState(mobileState, PREPROD, now), {
  platform: 'mobile',
  returnUrl: 'remote365://auth/callback',
  accountType: undefined,
  handoff: undefined,
});

console.log('oauthState tests passed');
