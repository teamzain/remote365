/*
 * End-to-end check of the OAuth routes: start route -> provider -> callback ->
 * where the tokens go. Google, Microsoft, the database, Redis and token issuing
 * are faked in-process; everything else is the real route code.
 *
 *   ts-node -T src/routes/oauth.test.ts
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import Module from 'node:module';
import path from 'node:path';
import Fastify from 'fastify';

// Preprod's URL settings.
const PREPROD_ENV: Record<string, string | undefined> = {
  PUBLIC_WEB_URL: 'https://pp.remote365.ai',
  WEB_APP_URL: undefined,
  DOMAIN: 'pp.remote365.ai',
  CADDY_SITE: 'pp.remote365.ai, :80',
};
// Prod's (see oauthState.test.ts).
const PROD_ENV: Record<string, string | undefined> = {
  PUBLIC_WEB_URL: undefined,
  WEB_APP_URL: 'https://remote365.ai',
  DOMAIN: '159.65.84.190',
  CADDY_SITE: undefined,
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

setEnv({
  ...PREPROD_ENV,
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  GOOGLE_CALLBACK_URL: 'https://pp.remote365.ai/api/auth/oauth/google/callback',
  MICROSOFT_CLIENT_ID: 'ms-client',
  MICROSOFT_CLIENT_SECRET: 'ms-secret',
  MICROSOFT_CALLBACK_URL: 'https://pp.remote365.ai/api/auth/oauth/microsoft/callback',
  JWT_SECRET: 'route-test-secret',
  JWT_PRIVATE_KEY: undefined,
  OAUTH_STATE_SECRET: undefined,
  OAUTH_RETURN_ORIGINS: undefined,
  OAUTH_ALLOW_LOCAL_RETURN_URLS: undefined,
});

// ── Stand-ins for the database, Redis and token issuing ───────────────────

type FakeUser = { id: string; email: string; name: string; role: string; organizationId: string | null; is2FAEnabled?: boolean };
const users = new Map<string, FakeUser>([
  ['victim@example.com', { id: 'u-victim', email: 'victim@example.com', name: 'Victim', role: 'OWNER', organizationId: 'org-victim' }],
  ['mfa@example.com', { id: 'u-mfa', email: 'mfa@example.com', name: 'Mfa', role: 'OWNER', organizationId: 'org-mfa', is2FAEnabled: true }],
]);
const redis = new Map<string, string>();
let tokensIssued = 0;

const userDelegate = {
  findUnique: async ({ where }: any) => users.get(where.email) ?? null,
  create: async ({ data }: any) => {
    const user = { id: `u-${users.size + 1}`, ...data };
    users.set(user.email, user);
    return user;
  },
  update: async ({ where, data }: any) => {
    const user = [...users.values()].find((u) => u.id === where.id)!;
    Object.assign(user, data);
    return user;
  },
};

const stubs: Record<string, unknown> = {
  '@remotelink/shared': {
    prisma: {
      user: userDelegate,
      subscription: { create: async () => ({}) },
      $transaction: async (run: (tx: any) => unknown) => run({
        organization: { create: async ({ data }: any) => ({ id: `org-${data.slug}`, ...data }) },
        user: userDelegate,
      }),
    },
    redisPublisher: {
      set: async (key: string, value: string) => { redis.set(key, value); return 'OK'; },
      multi: () => {
        const ops: Array<() => [null, unknown]> = [];
        const chain = {
          get: (key: string) => { ops.push(() => [null, redis.get(key) ?? null]); return chain; },
          del: (key: string) => { ops.push(() => [null, redis.delete(key) ? 1 : 0]); return chain; },
          exec: async () => ops.map((op) => op()),
        };
        return chain;
      },
    },
    recordLogin: async () => {},
    getPlanLimits: async () => ({ limits: { maxConcurrentSessions: -1 } }),
    getTrialDays: async () => 14,
    trialDurationMs: (days: number) => days * 86_400_000,
    generateToken: () => 'temp-2fa-token',
  },
  '../utils/token-utils': {
    issueTokens: async () => {
      tokensIssued += 1;
      return { accessToken: `access-${tokensIssued}`, refreshToken: `refresh-${tokensIssued}`, sessionId: `sid-${tokensIssued}` };
    },
  },
  '../utils/authSessions': { saveAuthSession: async () => {}, enforceMaxSessions: async () => {} },
  '../utils/welcomeEmail': { sendWelcomeEmail: async () => {} },
  './auth': { isFreeMailDomain: (email: string) => /@(gmail|outlook|yahoo)\./i.test(email) },
};

// Serve the stubs to modules under src/ only.
const serviceSrc = path.resolve(__dirname, '..');
const loader = Module as unknown as { _load: (request: string, parent: { filename?: string } | null, isMain: boolean) => unknown };
const realLoad = loader._load;
loader._load = function (request, parent, isMain) {
  if (parent?.filename?.startsWith(serviceSrc) && Object.prototype.hasOwnProperty.call(stubs, request)) {
    return stubs[request];
  }
  return realLoad.call(this, request, parent, isMain);
};

// ── Fake identity providers ───────────────────────────────────────────────

let providerEmail = 'victim@example.com';
const providerCalls: string[] = [];

function providerAnswer(hostname: string, requestPath: string): unknown {
  providerCalls.push(`${hostname}${requestPath.split('?')[0]}`);
  switch (hostname) {
    case 'oauth2.googleapis.com':
    case 'login.microsoftonline.com':
      return { access_token: 'provider-access-token' };
    case 'www.googleapis.com':
      return { email: providerEmail, name: 'Victim' };
    case 'graph.microsoft.com':
      return { mail: providerEmail, displayName: 'Victim' };
    default:
      throw new Error(`Unexpected HTTPS call to ${hostname}`);
  }
}

function fakeResponse(body: unknown) {
  const res = new EventEmitter();
  setImmediate(() => {
    res.emit('data', JSON.stringify(body));
    res.emit('end');
  });
  return res;
}

const httpsModule = https as unknown as Record<string, unknown>;
httpsModule.request = (options: any, onResponse: (res: EventEmitter) => void) => {
  const req = Object.assign(new EventEmitter(), {
    write: () => {},
    end: () => onResponse(fakeResponse(providerAnswer(options.hostname, options.path))),
  });
  return req;
};
httpsModule.get = (options: any, onResponse: (res: EventEmitter) => void) => {
  setImmediate(() => onResponse(fakeResponse(providerAnswer(options.hostname, options.path))));
  return new EventEmitter();
};

// Loaded only now, so the stubs are in place.
const { default: oauthRoutes } = require('./oauth') as typeof import('./oauth');
const { decodeOauthState } = require('../utils/oauthState') as typeof import('../utils/oauthState');

// ── Tests ─────────────────────────────────────────────────────────────────

type Provider = 'google' | 'microsoft';

async function main() {
  const app = Fastify();
  await app.register(oauthRoutes, { prefix: '/api/auth/oauth' });
  await app.ready();

  /** Start route -> the state it put into the provider consent URL. */
  const start = async (provider: Provider, query: string) => {
    const res = await app.inject({ method: 'GET', url: `/api/auth/oauth/${provider}?${query}` });
    assert.equal(res.statusCode, 302, `start ${provider}?${query}`);
    const consent = new URL(String(res.headers.location));
    assert.equal(consent.hostname, provider === 'google' ? 'accounts.google.com' : 'login.microsoftonline.com');
    return consent.searchParams.get('state') ?? '';
  };
  const callback = (provider: Provider, state: string | null) => app.inject({
    method: 'GET',
    url: `/api/auth/oauth/${provider}/callback?code=provider-code${state === null ? '' : `&state=${encodeURIComponent(state)}`}`,
  });
  /** A whole sign-in: start route, the user signs in at the provider, callback. */
  const signIn = async (provider: Provider, query: string) => callback(provider, await start(provider, query));
  const exchange = (code: unknown) => app.inject({ method: 'POST', url: '/api/auth/oauth/exchange', payload: { code } });
  const redirectOf = (res: { statusCode: number; headers: Record<string, unknown> }) => {
    assert.equal(res.statusCode, 302);
    return new URL(String(res.headers.location));
  };
  const enc = encodeURIComponent;

  // 1. Foreign web returnUrl: dropped at the start, tokens go to our own site.
  for (const provider of ['google', 'microsoft'] as const) {
    const state = await start(provider, `platform=web&returnUrl=${enc('https://attacker.example/cb')}`);
    assert.equal(decodeOauthState(state)?.returnUrl, undefined);
    const res = await callback(provider, state);
    const to = redirectOf(res);
    assert.equal(`${to.origin}${to.pathname}`, 'https://pp.remote365.ai/auth/callback', `${provider}: tokens stay on our site`);
    assert.match(to.searchParams.get('accessToken') ?? '', /^access-\d+$/);
    assert.ok(!String(res.headers.location).includes('attacker'), `${provider}: nothing sent to the attacker`);
  }
  for (const returnUrl of [
    'https://attacker.example/auth/callback',
    'https://pp.remote365.ai.attacker.example/auth/callback',
    'https://pp.remote365.ai@attacker.example/auth/callback',
    'javascript:alert(1)',
  ]) {
    const res = await signIn('google', `platform=web&handoff=code&returnUrl=${enc(returnUrl)}`);
    const to = redirectOf(res);
    assert.equal(`${to.origin}${to.pathname}`, 'https://pp.remote365.ai/auth/callback', returnUrl);
    assert.ok(!String(res.headers.location).includes('attacker'), returnUrl);
    assert.equal((await exchange(to.searchParams.get('code'))).statusCode, 200);
  }

  // 2. A state made up outside our start route (e.g. put straight into a
  //    Google consent URL) is refused before the provider code is even used.
  const callsBefore = providerCalls.length;
  const forgedStates = [
    Buffer.from(JSON.stringify({ platform: 'web', returnUrl: 'https://attacker.example/auth/callback' })).toString('base64url'),
    Buffer.from(JSON.stringify({ platform: 'mobile', returnUrl: 'https://attacker.example/cb' })).toString('base64url'),
    'web',
    'desktop',
  ];
  for (const state of forgedStates) {
    for (const provider of ['google', 'microsoft'] as const) {
      const res = await callback(provider, state);
      assert.equal(res.statusCode, 400, `forged state refused: ${state.slice(0, 20)}`);
      assert.equal(res.headers.location, undefined);
    }
  }
  const missingState = await callback('google', null);
  assert.equal(missingState.statusCode, 400);
  // A genuine state with a doctored payload.
  const genuine = await start('google', `platform=web&returnUrl=${enc('https://pp.remote365.ai/auth/callback')}`);
  const doctored = `${Buffer.from(JSON.stringify({ platform: 'web', returnUrl: 'https://attacker.example/auth/callback', iat: Date.now() })).toString('base64url')}.${genuine.split('.')[1]}`;
  assert.equal((await callback('google', doctored)).statusCode, 400);
  assert.equal(providerCalls.length, callsBefore, 'no provider token exchange for a forged state');

  // 3. Allowed web returnUrl, older web builds (tokens in the URL).
  {
    const to = redirectOf(await signIn('google', `platform=web&returnUrl=${enc('https://pp.remote365.ai/auth/callback')}`));
    assert.equal(`${to.origin}${to.pathname}`, 'https://pp.remote365.ai/auth/callback');
    assert.match(to.searchParams.get('accessToken') ?? '', /^access-\d+$/);
    assert.match(to.searchParams.get('refreshToken') ?? '', /^refresh-\d+$/);
  }

  // 4. Allowed web returnUrl with the code handoff: no tokens in the URL, one
  //    exchange per code.
  for (const provider of ['google', 'microsoft'] as const) {
    const to = redirectOf(await signIn(provider, `platform=web&handoff=code&returnUrl=${enc('https://pp.remote365.ai/auth/callback')}`));
    assert.equal(`${to.origin}${to.pathname}`, 'https://pp.remote365.ai/auth/callback');
    assert.equal(to.searchParams.get('accessToken'), null);
    assert.equal(to.searchParams.get('refreshToken'), null);
    const code = to.searchParams.get('code') ?? '';
    assert.match(code, /^[A-Za-z0-9_-]{43}$/);
    const first = await exchange(code);
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers['cache-control'], 'no-store');
    const grant = first.json();
    assert.match(grant.accessToken, /^access-\d+$/);
    assert.match(grant.refreshToken, /^refresh-\d+$/);
    assert.equal((await exchange(code)).statusCode, 400, 'a code works once');
  }
  assert.equal((await exchange('x'.repeat(43))).statusCode, 400);
  assert.equal((await exchange('not-a-code')).statusCode, 400);
  assert.equal((await exchange(undefined)).statusCode, 400);
  assert.equal(redis.size, 0, 'redeemed codes are gone');

  // 5. 2FA accounts: the temp token rides the same handoff.
  providerEmail = 'mfa@example.com';
  {
    const to = redirectOf(await signIn('google', `platform=web&handoff=code&returnUrl=${enc('https://pp.remote365.ai/auth/callback')}`));
    assert.equal(to.searchParams.get('tempToken'), null);
    assert.deepEqual((await exchange(to.searchParams.get('code'))).json(), { twoFactorRequired: true, tempToken: 'temp-2fa-token' });

    const legacy = redirectOf(await signIn('google', `platform=web&returnUrl=${enc('https://attacker.example/auth/callback')}`));
    assert.equal(`${legacy.origin}${legacy.pathname}`, 'https://pp.remote365.ai/auth/callback');
    assert.equal(legacy.searchParams.get('tempToken'), 'temp-2fa-token');
  }
  providerEmail = 'victim@example.com';

  // 6. Local web development: loopback callbacks work on preprod, not on prod.
  {
    const to = redirectOf(await signIn('google', `platform=web&handoff=code&returnUrl=${enc('http://localhost:5175/auth/callback')}`));
    assert.equal(`${to.origin}${to.pathname}`, 'http://localhost:5175/auth/callback');

    setEnv(PROD_ENV);
    const prod = redirectOf(await signIn('google', `platform=web&handoff=code&returnUrl=${enc('http://localhost:5175/auth/callback')}`));
    assert.equal(`${prod.origin}${prod.pathname}`, 'https://remote365.ai/auth/callback');
    const prodSite = redirectOf(await signIn('google', `platform=web&returnUrl=${enc('https://www.remote365.ai/auth/callback')}`));
    assert.equal(`${prodSite.origin}${prodSite.pathname}`, 'https://www.remote365.ai/auth/callback');
    setEnv(PREPROD_ENV);
  }

  // 7. Mobile: straight back into the app through its own scheme.
  for (const scheme of ['remote365', 'remotelink']) {
    const res = await signIn('google', `platform=mobile&returnUrl=${enc(`${scheme}://auth/callback`)}`);
    const location = String(res.headers.location);
    assert.equal(res.statusCode, 302);
    assert.match(location, new RegExp(`^${scheme}://auth/callback\\?accessToken=access-\\d+&refreshToken=refresh-\\d+$`));
  }
  // A foreign mobile returnUrl falls back to the app's deep link page.
  providerEmail = 'new-user@example.com';
  for (const returnUrl of ['https://attacker.example/cb', 'exp://attacker.example/--/auth/callback']) {
    const res = await signIn('google', `platform=mobile&returnUrl=${enc(returnUrl)}`);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers.location, undefined);
    assert.match(res.body, /remote365:\/\/auth\/callback\?accessToken=access-\d+&refreshToken=refresh-\d+/);
    assert.ok(!res.body.includes('attacker'));
  }
  assert.ok(users.has('new-user@example.com'), 'first sign-in created the account');
  providerEmail = 'victim@example.com';

  // 8. Desktop: unchanged remote365://auth/callback deep link page; a
  //    returnUrl is never used.
  for (const query of ['platform=desktop', `platform=desktop&returnUrl=${enc('https://attacker.example/cb')}`]) {
    for (const provider of ['google', 'microsoft'] as const) {
      const res = await signIn(provider, query);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers.location, undefined);
      assert.match(String(res.headers['content-type']), /^text\/html/);
      const n = tokensIssued;
      assert.ok(res.body.includes(`"remote365://auth/callback?accessToken=access-${n}&refreshToken=refresh-${n}"`), 'deep link');
      assert.ok(!res.body.includes('attacker'));
    }
  }

  // 9. Business sign-up with a personal address: the error goes back to our
  //    own sign-up page, never to a foreign returnUrl.
  providerEmail = 'someone@gmail.com';
  {
    const foreign = redirectOf(await signIn('google', `platform=web&accountType=business&returnUrl=${enc('https://attacker.example/auth/callback')}`));
    assert.equal(`${foreign.origin}${foreign.pathname}`, 'https://pp.remote365.ai/register');
    assert.ok(foreign.searchParams.get('oauthError'));
    const local = redirectOf(await signIn('google', `platform=web&accountType=business&returnUrl=${enc('http://localhost:5175/auth/callback')}`));
    assert.equal(`${local.origin}${local.pathname}`, 'http://localhost:5175/register');
    const desktop = await signIn('google', 'platform=desktop&accountType=business');
    assert.equal(desktop.statusCode, 200);
    assert.ok(desktop.body.includes('remote365://auth/callback?error='));
  }
  providerEmail = 'victim@example.com';

  // 10. The provider's own error (user cancelled) is unchanged.
  const cancelled = await app.inject({ method: 'GET', url: '/api/auth/oauth/google/callback?error=access_denied&state=x' });
  assert.equal(cancelled.statusCode, 400);

  await app.close();
  console.log('oauth route tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
