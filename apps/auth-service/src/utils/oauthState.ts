import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { getPublicWebUrl } from './publicUrls';

/*
 * OAuth state and return URLs.
 *
 * The sign-in start routes take a client-supplied returnUrl, and the tokens
 * are appended to it after the provider callback. So a returnUrl may only
 * point back at one of our own clients:
 *   web     https://<a site origin of this deployment>/auth/callback
 *           (plus loopback origins while local development is allowed)
 *   mobile  the mobile app's own URL schemes
 *   desktop never: the desktop app always gets remote365://auth/callback
 * Anything else is dropped and the sign-in lands on the site's own callback.
 *
 * The state that carries these choices through the provider round trip is
 * HMAC-signed and timestamped, so a state made up outside the start routes
 * (e.g. put straight into a provider consent URL) is refused.
 */

type Env = Record<string, string | undefined>;

export type OauthPlatform = 'web' | 'desktop' | 'mobile';

export interface OauthState {
  platform: OauthPlatform;
  /** Validated for the platform; absent when none was given or it was refused. */
  returnUrl?: string;
  accountType?: 'business';
  /** Web: hand the tokens over as a one-time code instead of in the URL. */
  handoff?: 'code';
}

/** Schemes the mobile app registers (apps/remote-365-mobile/app.json "scheme"). */
export const MOBILE_RETURN_SCHEMES = ['remote365:', 'remotelink:'];

export const WEB_CALLBACK_PATH = '/auth/callback';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Loopback return URLs are refused by default where the production site runs.
const PRODUCTION_WEB_HOSTS = new Set(['remote365.ai', 'www.remote365.ai']);

// Long enough for a provider sign-in that needs a password reset or 2FA.
const STATE_MAX_AGE_MS = 30 * 60 * 1000;

export function normalizePlatform(value: unknown): OauthPlatform {
  return value === 'desktop' || value === 'mobile' ? value : 'web';
}

/** Site origins named by the deployment's env: site URLs, domain, Caddy sites. */
function configuredWebOrigins(env: Env): Set<string> {
  const origins = new Set<string>();
  const add = (entry: string) => {
    // Caddy site entries such as ":80" (a bare port) or wildcards are not origins.
    if (!entry || entry.startsWith(':') || entry.includes('*')) return;
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(entry) ? entry : `https://${entry}`);
    } catch {
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    // Prod's DOMAIN is the droplet IP; nobody browses the site by IP.
    if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) return;
    origins.add(url.origin);
    // Apex and www go together (prod redirects www to the apex).
    const port = url.port ? `:${url.port}` : '';
    if (url.hostname.startsWith('www.')) {
      origins.add(`${url.protocol}//${url.hostname.slice(4)}${port}`);
    } else if (url.hostname.split('.').length === 2) {
      origins.add(`${url.protocol}//www.${url.hostname}${port}`);
    }
  };
  for (const key of ['PUBLIC_WEB_URL', 'WEB_APP_URL', 'OAUTH_RETURN_ORIGINS', 'DOMAIN', 'CADDY_SITE']) {
    for (const entry of String(env[key] || '').split(/[\s,]+/)) add(entry);
  }
  return origins;
}

/** Origins a web sign-in may return to (loopback origins aside). */
export function allowedWebOrigins(env: Env = process.env): Set<string> {
  const origins = configuredWebOrigins(env);
  // Nothing configured: the site getPublicWebUrl() falls back to.
  if (origins.size === 0) {
    origins.add('https://remote365.ai');
    origins.add('https://www.remote365.ai');
  }
  return origins;
}

/**
 * Whether web sign-ins may return to http(s)://localhost, 127.0.0.1 or [::1]
 * on any port, i.e. the web app running on a developer's machine against this
 * backend. On unless this backend serves the production site;
 * OAUTH_ALLOW_LOCAL_RETURN_URLS=true|false decides explicitly.
 */
export function localReturnUrlsAllowed(env: Env = process.env): boolean {
  const flag = String(env.OAUTH_ALLOW_LOCAL_RETURN_URLS || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) return true;
  if (['0', 'false', 'no', 'off'].includes(flag)) return false;
  for (const origin of configuredWebOrigins(env)) {
    if (PRODUCTION_WEB_HOSTS.has(new URL(origin).hostname)) return false;
  }
  return true;
}

/**
 * The returnUrl if it points back at one of our own clients for `platform`,
 * otherwise undefined. Web URLs come back normalised to <origin>/auth/callback.
 */
export function validateReturnUrl(platform: OauthPlatform, value: unknown, env: Env = process.env): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 2048) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.username || url.password) return undefined;

  if (platform === 'mobile') {
    if (!MOBILE_RETURN_SCHEMES.includes(url.protocol)) return undefined;
    url.hash = '';
    return url.toString();
  }
  if (platform !== 'web') return undefined;

  if (url.pathname !== WEB_CALLBACK_PATH) return undefined;
  const loopback = LOOPBACK_HOSTS.has(url.hostname) && (url.protocol === 'http:' || url.protocol === 'https:');
  const allowed = loopback ? localReturnUrlsAllowed(env) : allowedWebOrigins(env).has(url.origin);
  return allowed ? `${url.origin}${WEB_CALLBACK_PATH}` : undefined;
}

/** Where a web sign-in lands: the validated returnUrl, else the site's own callback page. */
export function webCallbackUrl(state: Pick<OauthState, 'returnUrl'>): string {
  return state.returnUrl || `${getPublicWebUrl()}${WEB_CALLBACK_PATH}`;
}

let ephemeralStateKey: Buffer | null = null;

function stateKey(env: Env): Buffer {
  const secret = env.OAUTH_STATE_SECRET || env.JWT_SECRET || env.JWT_PRIVATE_KEY;
  if (secret) return createHash('sha256').update(`remote365 oauth state\n${secret}`).digest();
  // No secret configured (local development): a per-process key, so a
  // sign-in started before a restart has to be started again.
  if (!ephemeralStateKey) ephemeralStateKey = randomBytes(32);
  return ephemeralStateKey;
}

function signState(payload: string, env: Env): Buffer {
  return createHmac('sha256', stateKey(env)).update(payload).digest();
}

/** Signed, timestamped state for the provider round trip. */
export function encodeOauthState(state: OauthState, env: Env = process.env, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...state, iat: now }), 'utf8').toString('base64url');
  return `${payload}.${signState(payload, env).toString('base64url')}`;
}

/**
 * The state as a start route issued it, or null when it is missing, forged,
 * altered or expired. The returnUrl is validated again in case the allowlist
 * changed since the sign-in started.
 */
export function decodeOauthState(value: unknown, env: Env = process.env, now = Date.now()): OauthState | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = signState(payload, env);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let data: any;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const issuedAt = Number(data.iat);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > STATE_MAX_AGE_MS) return null;

  const platform = normalizePlatform(data.platform);
  return {
    platform,
    returnUrl: validateReturnUrl(platform, data.returnUrl, env),
    accountType: data.accountType === 'business' ? 'business' : undefined,
    handoff: platform === 'web' && data.handoff === 'code' ? 'code' : undefined,
  };
}
