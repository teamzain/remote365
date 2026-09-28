import https from 'https';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, redisPublisher, recordLogin, getPlanLimits, getTrialDays, trialDurationMs } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';
import { saveAuthSession, enforceMaxSessions } from '../utils/authSessions';
import { sendWelcomeEmail } from '../utils/welcomeEmail';
import { isFreeMailDomain } from './auth';
import { getPublicWebUrl } from '../utils/publicUrls';
import { twoFactorGate, TWO_FACTOR_SETUP_MOBILE_MESSAGE } from '../utils/twoFactorGate';
import {
  OauthState,
  decodeOauthState,
  encodeOauthState,
  normalizePlatform,
  validateReturnUrl,
  webCallbackUrl,
} from '../utils/oauthState';

// ── Helpers ────────────────────────────────────────────────────────────────

function httpsPost(hostname: string, path: string, body: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON: ${data}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname: string, path: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname, path, headers: { Authorization: `Bearer ${accessToken}` } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON: ${data}`)); }
        });
      }
    ).on('error', reject);
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

const launchIllustrationCandidates = [
  path.resolve(__dirname, '../assets/wait.png'),
  path.resolve(__dirname, '../../src/assets/wait.png'),
  path.resolve(__dirname, '../../../desktop/src/renderer/assets/wait.png'),
];
const launchIllustrationPath = launchIllustrationCandidates.find((candidate) => existsSync(candidate));
const launchIllustrationSrc = launchIllustrationPath
  ? `data:image/png;base64,${readFileSync(launchIllustrationPath).toString('base64')}`
  : '';

/**
 * Signed state for a start route. Business sign-ups keep their type through the
 * round trip (the company-email check depends on it). A returnUrl that is not
 * one of our own clients' callbacks is dropped, so the tokens can never be
 * sent to it.
 */
function startOauthState(request: FastifyRequest) {
  const query = request.query as { platform?: string; returnUrl?: string; accountType?: string; handoff?: string };
  const platform = normalizePlatform(query.platform);
  const returnUrl = validateReturnUrl(platform, query.returnUrl);
  if (query.returnUrl && !returnUrl && platform !== 'desktop') {
    request.log.warn(`[OAuth] Ignoring returnUrl that is not an allowed ${platform} callback: ${JSON.stringify(String(query.returnUrl).slice(0, 200))}`);
  }
  return encodeOauthState({
    platform,
    returnUrl,
    accountType: query.accountType === 'business' ? 'business' : undefined,
    handoff: platform === 'web' && query.handoff === 'code' ? 'code' : undefined,
  });
}

const INVALID_STATE_ERROR = 'This sign-in link is invalid or has expired. Please start the sign-in again.';

// ── Web token handoff ──────────────────────────────────────────────────────
// Web clients that ask for it (handoff=code) get a one-time code on
// /auth/callback instead of the tokens themselves, and trade it through
// POST /exchange, so the tokens never sit in a URL, the browser history or a
// Referer. The code lives in Redis for two minutes and works once.

// `setup`: the org requires 2FA and the account has none, so the temp token
// starts the 2FA setup (see utils/twoFactorGate) instead of a code check.
type OauthGrant = { accessToken: string; refreshToken: string } | { tempToken: string; setup?: boolean };

const HANDOFF_TTL_SECONDS = 120;
const handoffKey = (code: string) => `auth:oauth:handoff:${code}`;

async function createHandoffCode(grant: OauthGrant) {
  const code = randomBytes(32).toString('base64url');
  await redisPublisher.set(handoffKey(code), JSON.stringify(grant), 'EX', HANDOFF_TTL_SECONDS);
  return code;
}

async function redeemHandoffCode(code: string): Promise<OauthGrant | null> {
  // GET + DEL in one transaction: only the first redeemer gets the grant.
  const results = await redisPublisher.multi().get(handoffKey(code)).del(handoffKey(code)).exec();
  const raw = results?.[0]?.[1];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as OauthGrant;
  } catch {
    return null;
  }
}

/** Send a web sign-in (tokens, or the 2FA temp token) back to its callback page. */
async function redirectToWeb(reply: FastifyReply, oauthState: OauthState, grant: OauthGrant) {
  const callbackUrl = webCallbackUrl(oauthState);
  if (oauthState.handoff === 'code') {
    return reply.redirect(appendParamToUrl(callbackUrl, 'code', await createHandoffCode(grant)));
  }
  // Web builds from before the code handoff read the tokens from the URL.
  if ('tempToken' in grant) {
    const withToken = appendParamToUrl(callbackUrl, 'tempToken', grant.tempToken);
    return reply.redirect(grant.setup ? appendParamToUrl(withToken, 'setup2fa', '1') : withToken);
  }
  return reply.redirect(appendTokensToUrl(callbackUrl, grant));
}

function appendTokensToUrl(returnUrl: string, tokens: { accessToken: string; refreshToken: string }) {
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
}

function appendParamToUrl(returnUrl: string, key: string, value: string) {
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function getRequestOrigin(request: FastifyRequest) {
  const proto = String(request.headers['x-forwarded-proto'] || '').split(',')[0]?.trim() || 'https';
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0]?.trim();
  return host ? `${proto}://${host}` : '';
}

function getGoogleCallbackUrl(request: FastifyRequest) {
  return process.env.GOOGLE_CALLBACK_URL || `${getRequestOrigin(request)}/api/auth/oauth/google/callback`;
}

function renderDesktopLaunchPage(deepLink: string, targetLabel = 'Remote 365 desktop application') {
  const illustrationMarkup = launchIllustrationSrc
    ? `<img src="${launchIllustrationSrc}" alt="" class="launch-illustration" />`
    : `<div class="launch-illustration-fallback" aria-hidden="true"></div>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Launching Remote 365</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Mona+Sans:wght@400;500&display=swap');
          * { box-sizing: border-box; }
          body {
            position: relative;
            width: 100vw;
            min-height: 100vh;
            margin: 0;
            overflow: hidden;
            background: #FFFFFF;
            color: #000000;
            font-family: 'Mona Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .launch-glow {
            position: absolute;
            width: 1748px;
            height: 517px;
            left: calc(50% - 1748px / 2);
            top: -400px;
            background: linear-gradient(360deg, rgba(255, 255, 255, 0.375) -16.83%, rgba(255, 179, 71, 0.6) 29.84%, rgba(255, 138, 0, 0.75) 76.5%);
            filter: blur(39.5px);
            pointer-events: none;
          }
          .launch-content {
            position: absolute;
            width: 377px;
            height: 437px;
            left: calc(50% - 377px / 2);
            top: 231px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 60px;
            animation: fadeIn 0.45s ease-out both;
          }
          .launch-copy {
            width: 377px;
            height: 337px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 45px;
          }
          .launch-illustration,
          .launch-illustration-fallback {
            width: 251px;
            height: 214px;
            object-fit: contain;
            flex: none;
          }
          .launch-illustration-fallback {
            border-radius: 24px;
            background: #F3F4F6;
          }
          .launch-text {
            width: 377px;
            height: 78px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            text-align: center;
          }
          h1 {
            width: 377px;
            height: 34px;
            margin: 0;
            font-family: 'Mona Sans', system-ui, sans-serif;
            font-size: 24px;
            line-height: 34px;
            font-weight: 500;
            color: #000000;
            letter-spacing: 0;
          }
          p {
            width: 377px;
            height: 30px;
            margin: 0;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 12px;
            line-height: 15px;
            font-weight: 400;
            text-align: center;
            color: #000000;
          }
          .button {
            width: 153px;
            height: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 10px 16px;
            border: 0;
            border-radius: 4px;
            background: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%);
            color: #111315;
            text-decoration: none;
            font-family: 'Mona Sans', system-ui, sans-serif;
            font-size: 14px;
            line-height: 20px;
            font-weight: 500;
            transition: transform 0.18s ease, filter 0.18s ease;
          }
          .button:hover {
            transform: translateY(-1px);
            filter: brightness(1.02);
          }
          .launch-footer {
            position: absolute;
            width: 226px;
            height: 25px;
            left: calc(50% - 226px / 2);
            top: 867px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: rgba(26, 29, 33, 0.5);
            text-align: center;
          }
          .launch-footer a {
            width: 226px;
            height: 14px;
            color: inherit;
            text-decoration: none;
            font-family: 'Mona Sans', system-ui, sans-serif;
            font-size: 10px;
            line-height: 14px;
            font-weight: 400;
          }
          .launch-footer span {
            width: 226px;
            height: 11px;
            font-family: 'Mona Sans', system-ui, sans-serif;
            font-size: 8px;
            line-height: 11px;
            font-weight: 400;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 700px), (max-height: 760px) {
            body { overflow: auto; min-height: 720px; }
            .launch-content {
              top: 160px;
              width: min(377px, calc(100vw - 32px));
              left: 50%;
              transform: translateX(-50%);
            }
            .launch-copy,
            .launch-text,
            h1,
            p { width: 100%; }
            .launch-footer {
              top: auto;
              bottom: 8px;
            }
          }
        </style>
      </head>
      <body>
        <div class="launch-glow"></div>
        <main class="launch-content">
          <section class="launch-copy">
            ${illustrationMarkup}
            <div class="launch-text">
              <h1>Launching Remote 365</h1>
              <p>Allow your browser to launch the ${targetLabel}, to complete your Sign in.</p>
            </div>
          </section>
          <a href="${deepLink}" class="button">Open Remote 365</a>
        </main>
        <footer class="launch-footer">
          <a href="https://remote365.ai/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
          <span>Copyright 2026 &copy; Remote 365. All right reserved.</span>
        </footer>
        <script>
          const deepLink = ${JSON.stringify(deepLink)};
          const openRemote365 = () => {
            window.location.href = deepLink;
          };
          document.querySelector('.button')?.addEventListener('click', (event) => {
            event.preventDefault();
            openRemote365();
          });
          setTimeout(openRemote365, 900);
        </script>
      </body>
    </html>
  `;
}


/**
 * Everything after the identity provider handed us a verified email: find or
 * create the account (first sign-in creates its workspace + trial and gets the
 * welcome email), 2FA hand-off, session cap, login history, and the redirect
 * back to the desktop / mobile / web client. Shared by Google and Microsoft.
 */
async function finishOauthSignIn(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  profile: { email: string; name?: string | null },
  oauthState: OauthState,
) {
  const platform = oauthState.platform;
  const isBusiness = oauthState.accountType === 'business';
  if (isBusiness && isFreeMailDomain(profile.email)) {
    const message = 'Business accounts need a company email address. Personal providers such as Gmail, Outlook or Yahoo are not accepted.';
    if (platform === 'web') {
      const base = (() => { try { return new URL(webCallbackUrl(oauthState)).origin; } catch { return getPublicWebUrl(); } })();
      return reply.redirect(`${base}/register?oauthError=${encodeURIComponent(message)}`);
    }
    // Desktop / mobile: hand the message to the app through the deep link so it shows on the sign-up screen.
    return reply.type('text/html').send(renderDesktopLaunchPage(`remote365://auth/callback?error=${encodeURIComponent(message)}`, platform === 'mobile' ? 'Remote 365 mobile app' : undefined));
  }
    // Search for user or create one
    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      // SaaS onboarding: create an organization with the Google user as its owner.
      const result = await prisma.$transaction(async (tx: any) => {
        const orgSlug = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
        const org = await tx.organization.create({
          data: {
            name: profile.name ? `${profile.name}'s Workspace` : `${profile.email.split('@')[0]}'s Workspace`,
            slug: orgSlug,
            ...(isBusiness ? { accountType: 'BUSINESS', companyEmail: profile.email } : {}),
          }
        });

        return await tx.user.create({
          data: {
            email: profile.email,
            name: profile.name || profile.email.split('@')[0],
            role: 'OWNER',
            organizationId: org.id,
            allowedDeviceIds: ['__all__']
          }
        });
      });

      user = result;

      // Create initial subscription (trial length from the merged catalog)
      try {
        await prisma.subscription.create({
          data: {
            userId: user!.id,
            plan: 'TRIAL',
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + trialDurationMs(await getTrialDays()))
          },
        });
      } catch { }
      sendWelcomeEmail(user!).catch(() => {});
    } else {
      // If user already exists but doesn't have an org, create one and make them the owner.
      if (!user.organizationId) {
        user = await prisma.$transaction(async (tx: any) => {
          const orgSlug = user!.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
          const org = await tx.organization.create({
            data: {
              name: user!.name ? `${user!.name}'s Workspace` : `${user!.email.split('@')[0]}'s Workspace`,
              slug: orgSlug
            }
          });

          return await tx.user.update({
            where: { id: user!.id },
            data: {
              role: 'OWNER',
              organizationId: org.id,
              allowedDeviceIds: ['__all__']
            }
          });
        });
      } else if (!user.name && profile.name) {
        // Normal name backfill
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: profile.name },
        });
      }
    }

    // ── 2FA Check ──
    // verify: the account has 2FA, enter the code. setup: the org requires
    // 2FA and the account has none, so the app shows the setup (QR code)
    // step instead. The mobile app has no setup step yet: it gets the
    // message on its sign-in screen, like a refused business sign-up.
    const gate = await twoFactorGate(user);
    if (gate?.kind === 'setup' && platform === 'mobile') {
      return reply.type('text/html').send(renderDesktopLaunchPage(`remote365://auth/callback?error=${encodeURIComponent(TWO_FACTOR_SETUP_MOBILE_MESSAGE)}`, 'Remote 365 mobile app'));
    }
    if (gate) {
      const { tempToken } = gate;
      const setup = gate.kind === 'setup';

      if (platform === 'desktop' || platform === 'mobile') {
        const deepLink = `remote365://auth/2fa?tempToken=${tempToken}${setup ? '&setup=1' : ''}`;
        const title = setup ? 'Set Up 2FA' : '2FA Required';
        const hint = setup
          ? 'Your organization requires two-factor authentication. Open the Remote 365 app to set it up.'
          : 'Please open the Remote 365 app to enter your security code.';
        return reply.type('text/html').send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title} | Remote 365</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #f8fafc;
                  color: #0f172a;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  text-align: center;
                }
                .card {
                  background: white;
                  padding: 48px;
                  border-radius: 24px;
                  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
                  max-width: 400px;
                  animation: slideUp 0.6s ease-out;
                }
                .icon-box {
                  width: 72px;
                  height: 72px;
                  background: #eff6ff;
                  border-radius: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 24px;
                  color: #2563eb;
                }
                h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em; }
                p { color: #64748b; line-height: 1.6; margin-bottom: 32px; }
                .btn {
                  display: inline-block;
                  background: #2563eb;
                  color: white;
                  text-decoration: none;
                  padding: 14px 32px;
                  border-radius: 12px;
                  font-weight: 600;
                  transition: all 0.2s;
                }
                .btn:hover { background: #1d4ed8; transform: translateY(-1px); }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon-box">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h1>${title}</h1>
                <p>${hint}</p>
                <a href="${deepLink}" class="btn">Open Remote 365</a>
              </div>
              <script>setTimeout(() => { window.location.href = "${deepLink}"; }, 1000);</script>
            </body>
          </html>
        `);
      }

      return redirectToWeb(reply, oauthState, setup ? { tempToken, setup: true } : { tempToken });
    }

    // Issue our own JWT tokens
    const tokens = await issueTokens(user!);

    // Register the session and cap concurrent logins at the effective plan's
    // maxConcurrentSessions (applied per-user: owner and each member get the
    // cap independently). If this login pushes the count over, the OLDEST
    // sessions are revoked. -1/null = unlimited.
    try {
      await saveAuthSession(user!, tokens.sessionId, request);
      try {
        const { limits } = await getPlanLimits(user!.id);
        const cap = Number((limits as any)?.maxConcurrentSessions);
        const maxSessions = Number.isFinite(cap) && cap > 0 ? cap : Number.POSITIVE_INFINITY;
        if (Number.isFinite(maxSessions)) {
          await enforceMaxSessions(user!.id, tokens.sessionId, maxSessions);
        }
      } catch (planErr: any) {
        console.error('[OAuth] Failed to enforce concurrent-session cap:', planErr?.message || planErr);
      }
    } catch (err: any) {
      console.error('[OAuth] Session registration failed:', err.message);
    }

    // Record the successful sign-in for the user's login history.
    await recordLogin({
      userId: user!.id,
      email: user!.email,
      ip: (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || null,
      userAgent: (request.headers['user-agent'] as string) || null,
      result: 'SUCCESS',
    });

    // Redirect back to the client
    if (platform === 'desktop' || platform === 'mobile') {
      const deepLink = `remote365://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      // Mobile returnUrls were checked against the app's own schemes.
      const mobileReturnUrl = platform === 'mobile' && oauthState.returnUrl
        ? appendTokensToUrl(oauthState.returnUrl, tokens)
        : null;

      if (mobileReturnUrl) {
        return reply.redirect(mobileReturnUrl);
      }

      if (platform === 'mobile') {
        return reply.type('text/html').send(renderDesktopLaunchPage(deepLink, 'Remote 365 mobile app'));
      }

      return reply.type('text/html').send(renderDesktopLaunchPage(deepLink));
    }

    // Web fallback: the React app completes token storage on /auth/callback.
    return redirectToWeb(reply, oauthState, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

}

function getMicrosoftCallbackUrl(request: FastifyRequest) {
  return process.env.MICROSOFT_CALLBACK_URL || `${getRequestOrigin(request)}/api/auth/oauth/microsoft/callback`;
}

export default async function oauthRoutes(fastify: FastifyInstance) {

  // Step 1 — Redirect user to Google consent screen
  fastify.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = getGoogleCallbackUrl(request);

    if (!clientId) {
      return reply.code(500).send({ error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID in environment.' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state: startOauthState(request),
      access_type: 'offline',
      prompt: 'select_account',
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Step 2 — Google redirects back here with ?code=...&state=...
  fastify.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };

    if (error || !code) {
      return reply.code(400).send({ error: error || 'No authorization code received from Google' });
    }

    // Only a state our start route signed decides where the tokens go.
    const oauthState = decodeOauthState(state);
    if (!oauthState) {
      return reply.code(400).send({ error: INVALID_STATE_ERROR });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = getGoogleCallbackUrl(request);

    if (!clientId || !clientSecret) {
      return reply.code(500).send({ error: 'Google OAuth credentials not configured' });
    }

    try {
      // Exchange authorization code for Google tokens
      const tokenBody = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString();

      const googleTokens = await httpsPost('oauth2.googleapis.com', '/token', tokenBody, {});

      if (googleTokens.error) {
        fastify.log.error(`Google token exchange failed: ${googleTokens.error_description}`);
        return reply.code(400).send({ error: `Google error: ${googleTokens.error_description}` });
      }

      // Fetch user profile from Google
      const googleUser = await httpsGet('www.googleapis.com', '/oauth2/v2/userinfo', googleTokens.access_token);

      if (!googleUser.email) {
        return reply.code(400).send({ error: 'Could not retrieve email from Google account' });
      }

      return await finishOauthSignIn(fastify, request, reply, { email: googleUser.email, name: googleUser.name }, oauthState);
    } catch (err: any) {
      fastify.log.error(`Google OAuth callback error: ${err.message}`);
      return reply.code(500).send({ error: 'Authentication failed. Please try again.' });
    }
  });

  // ── Microsoft (Entra ID / personal Microsoft accounts) ────────────────────
  // Same shape as Google: consent redirect, code exchange, Graph profile, then
  // the shared finishOauthSignIn(). Tenant defaults to "common" (work, school
  // and personal accounts); set MICROSOFT_TENANT_ID to restrict it.
  fastify.get('/microsoft', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return reply.code(500).send({ error: 'Microsoft sign-in is not configured. Set MICROSOFT_CLIENT_ID in environment.' });
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getMicrosoftCallbackUrl(request),
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid email profile User.Read',
      state: startOauthState(request),
      prompt: 'select_account',
    });
    return reply.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
  });

  fastify.get('/microsoft/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    if (error || !code) {
      return reply.code(400).send({ error: error_description || error || 'No authorization code received from Microsoft' });
    }
    const oauthState = decodeOauthState(state);
    if (!oauthState) {
      return reply.code(400).send({ error: INVALID_STATE_ERROR });
    }
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return reply.code(500).send({ error: 'Microsoft sign-in credentials not configured' });
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    try {
      const tokenBody = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getMicrosoftCallbackUrl(request),
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read',
      }).toString();
      const msTokens = await httpsPost('login.microsoftonline.com', `/${tenant}/oauth2/v2.0/token`, tokenBody, {});
      if (msTokens.error) {
        fastify.log.error(`Microsoft token exchange failed: ${msTokens.error_description}`);
        return reply.code(400).send({ error: `Microsoft error: ${msTokens.error_description}` });
      }
      // Graph: work/school accounts carry the address in mail, personal ones in
      // userPrincipalName (or otherMails).
      const me = await httpsGet('graph.microsoft.com', '/v1.0/me?$select=displayName,mail,userPrincipalName,otherMails', msTokens.access_token);
      const email = String(me.mail || (Array.isArray(me.otherMails) && me.otherMails[0]) || me.userPrincipalName || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return reply.code(400).send({ error: 'Could not retrieve an email address from the Microsoft account' });
      }
      return await finishOauthSignIn(fastify, request, reply, { email, name: me.displayName }, oauthState);
    } catch (err: any) {
      fastify.log.error(`Microsoft OAuth callback error: ${err.message}`);
      return reply.code(500).send({ error: 'Authentication failed. Please try again.' });
    }
  });

  // Step 3 (web, handoff=code) — /auth/callback trades the one-time code for
  // the tokens, or for the 2FA temp token.
  fastify.post('/exchange', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = (request.body || {}) as { code?: unknown };
    reply.header('Cache-Control', 'no-store');
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
      return reply.code(400).send({ error: 'Invalid sign-in code' });
    }
    const grant = await redeemHandoffCode(code);
    if (!grant) {
      return reply.code(400).send({ error: 'This sign-in has expired. Please sign in again.' });
    }
    if ('tempToken' in grant) {
      return reply.send(grant.setup
        ? { twoFactorRequired: true, twoFactorSetupRequired: true, tempToken: grant.tempToken }
        : { twoFactorRequired: true, tempToken: grant.tempToken });
    }
    return reply.send({ accessToken: grant.accessToken, refreshToken: grant.refreshToken });
  });

  fastify.get('/github', async (_request, reply) => {
    return reply.send({ message: 'GitHub OAuth coming soon' });
  });

  fastify.get('/github/callback', async (_request, reply) => {
    return reply.send({ message: 'GitHub OAuth callback coming soon' });
  });
}
