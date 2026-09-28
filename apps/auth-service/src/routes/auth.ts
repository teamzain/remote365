import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma, publishEvent, EventChannel, verifyToken, blacklistToken, isTokenBlacklisted, redisPublisher, recordActivity, recordLogin, resolveRoleFeatures, resolveEffectivePermissions, getPlanLimits, getCloudflareTurnEntry, hostSecretMatches, getTrialDays, trialDurationMs } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';
import { sendTemplatedEmail, smtpConfigured } from '../utils/emailTemplates';
import { sendWelcomeEmail } from '../utils/welcomeEmail';
import {
  AUTH_SESSION_TTL_SECONDS, authSessionKey, authSessionIndexKey, authSessionRevokedKey,
  legacySessionIdFromToken, requestIp, saveAuthSession, enforceMaxSessions,
} from '../utils/authSessions';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import * as QRCode from 'qrcode';
import { twoFactorGate, TWO_FACTOR_SETUP_MESSAGE } from '../utils/twoFactorGate';

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin()
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// Business sign-ups must use a company mailbox, not a personal provider.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.de', 'gmx.net',
  'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'zohomail.com', 'inbox.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'tuta.io',
]);
export const isFreeMailDomain = (email: string) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return !domain || FREE_MAIL_DOMAINS.has(domain);
};

type BusinessDetails = {
  companyName: string; businessNumber: string; website?: string;
  addressLine: string; city: string; country: string; postalCode?: string; state?: string;
};
// Returns the cleaned details or an error message.
const readBusinessDetails = (body: any): { details?: BusinessDetails; error?: string } => {
  const clean = (value: unknown) => String(value ?? '').trim();
  const details: BusinessDetails = {
    companyName: clean(body?.companyName), businessNumber: clean(body?.businessNumber), website: clean(body?.website) || undefined,
    addressLine: clean(body?.addressLine), city: clean(body?.city), country: clean(body?.country), postalCode: clean(body?.postalCode) || undefined, state: clean(body?.state) || undefined,
  };
  if (!details.companyName) return { error: 'Company name is required.' };
  if (!details.businessNumber) return { error: 'Business registration number is required.' };
  if (!details.country || !details.city || !details.addressLine) return { error: 'Company address (country, city and street address) is required.' };
  if ((details.country === 'United States' || details.country === 'Canada') && !details.state) return { error: details.country === 'Canada' ? 'Province is required.' : 'State is required.' };
  return { details };
};
const SUPPORTED_LANGUAGES = new Set(['en', 'de', 'fr', 'es', 'ar-SA']);
const normalizeLanguage = (value: any) => {
  const language = String(value || '').trim();
  if (SUPPORTED_LANGUAGES.has(language)) return language;
  if (language.toLowerCase() === 'ar' || language.toLowerCase() === 'ar-sa') return 'ar-SA';
  return 'en';
};

// The plan is org-level: members (ADMIN/VIEWER) share the org owner's
// subscription rather than their own (they don't buy a seat). EVERY response
// that carries `plan` must resolve through this, or a member's client ends up
// stamped back to TRIAL by whichever endpoint forgot the inheritance.
async function resolveEffectiveSubscription(user: { role?: any; organizationId?: string | null; subscription?: any }) {
  const role = String(user.role || '').toUpperCase();
  if (role === 'OWNER' || role === 'SUPER_ADMIN' || !user.organizationId) return user.subscription;
  const orgOwner = await prisma.user.findFirst({
    where: { organizationId: user.organizationId, role: 'OWNER' },
    include: { subscription: true },
    orderBy: { createdAt: 'asc' }
  });
  return (orgOwner as any)?.subscription || user.subscription;
}

// Settings → Security payload from the desktop app. Everything is whitelisted
// and clamped here so the Json column only ever holds this shape.
const sanitizeSecuritySettings = (raw: any) => {
  if (!raw || typeof raw !== 'object') return null;
  const list = (v: any) => Array.isArray(v)
    ? Array.from(new Set(v.map((x: any) => String(x).trim().slice(0, 200)).filter(Boolean))).slice(0, 100)
    : [];
  const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    blockList: list(raw.blockList),
    allowList: list(raw.allowList),
    requirePassword: bool(raw.requirePassword, false),
    easyAccess: bool(raw.easyAccess, true),
    // Applied by the desktop host when the last viewer leaves.
    lockOnDisconnect: bool(raw.lockOnDisconnect, false),
    // "Confirm each incoming connection" is the device's
    // allowControlWithoutPrompt setting, and the access-control / security-key
    // fields were never enforced anywhere, so none of them live here any more.
  };
};

// When a Super Admin suspends an organization, every member is locked out
// everywhere: login is blocked, token refresh fails, and /me rejects so any
// already-signed-in client is kicked out on its next check.
const SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact support.';
// An org admin toggled the member Inactive (Members page): a temporary,
// reversible lock with its own message so the user knows who to contact.
const RESTRICTED_MESSAGE = 'Your account has been temporarily restricted by your organization. Please contact your administrator.';

async function isOrgSuspended(organizationId: string | null | undefined): Promise<boolean> {
  if (!organizationId) return false;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true }
  });
  // A suspended OR (soft) deleted organization blocks its members.
  return ['SUSPENDED', 'DELETED'].includes(String((org as any)?.status || 'ACTIVE').toUpperCase());
}

// A user is blocked when their own account is suspended/deleted/deactivated,
// or their org is. Returns the 403 payload to send, or null when allowed.
async function getAccountBlock(user: any): Promise<{ error: string; suspended: boolean; restricted?: boolean } | null> {
  const status = String(user?.status || 'ACTIVE').toUpperCase();
  if (status === 'INACTIVE') return { error: RESTRICTED_MESSAGE, suspended: true, restricted: true };
  if (['SUSPENDED', 'DELETED'].includes(status)) return { error: SUSPENDED_MESSAGE, suspended: true };
  if (await isOrgSuspended(user?.organizationId)) return { error: SUSPENDED_MESSAGE, suspended: true };
  return null;
}

async function issueTokensForRequest(user: any, request: FastifyRequest, sessionId?: string) {
  const tokens = await issueTokens(user, { sessionId });
  await saveAuthSession(user, tokens.sessionId, request);
  // Fresh sign-in (no pre-existing session id, i.e. not a refresh) — cap the
  // account's concurrent logins at the effective plan's maxConcurrentSessions.
  // Applied per-user: the owner and each member get the cap independently. If
  // this login pushes the count over, the OLDEST sessions are revoked so /me
  // and /refresh reject them on their next check. -1/null = unlimited.
  if (!sessionId) {
    try {
      const { limits } = await getPlanLimits(user.id);
      const cap = Number((limits as any)?.maxConcurrentSessions);
      const maxSessions = Number.isFinite(cap) && cap > 0 ? cap : Number.POSITIVE_INFINITY;
      if (Number.isFinite(maxSessions)) {
        await enforceMaxSessions(user.id, tokens.sessionId, maxSessions);
      }
    } catch (err: any) {
      console.error('[Auth] Failed to enforce concurrent-session cap:', err?.message || err);
    }
  }
  return tokens;
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'auth-service' };
  });

  fastify.post('/request-verification', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, accountType } = request.body as any;
    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }
    if (String(accountType || '').toLowerCase() === 'business') {
      if (isFreeMailDomain(email)) return reply.code(400).send({ error: 'Business accounts need a company email address. Personal providers such as Gmail, Outlook or Yahoo are not accepted.' });
      const { error } = readBusinessDetails(request.body);
      if (error) return reply.code(400).send({ error });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { email, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return reply.code(400).send({ error: 'You have a pending invitation. Please use the invite link to join your organization.' });
    }

    // A re-request inside the window resends the SAME code (the first email
    // may still be open in the inbox); only an expired code is replaced.
    const previous = verificationCodes.get(email);
    const code = previous && previous.expiresAt > Date.now()
      ? previous.code
      : Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    verificationCodes.set(email, { code, expiresAt });

    try {
      // 1. ALWAYS Log the code to the terminal in development for easy access
      console.log('\n' + '='.repeat(50));
      console.log(`[AUTH-DEV] VERIFICATION CODE FOR ${email}: ${code}`);
      console.log('='.repeat(50) + '\n');

      if (smtpConfigured()) {
        try {
          await sendTemplatedEmail({ to: email, key: 'email-verification', vars: { code, email } });
          console.log(`[Auth] Sent verification email successfully to ${email}`);
        } catch (mailErr: any) {
          // If mail fails but it's a timeout or network issue, we JUST LOG IT and don't fail the request.
          // This allows the user to use the code from the terminal.
          console.error(`[Auth] SMTP Delivery Failed (Bypassing for Dev): ${mailErr.message}`);
          // The client shows this instead of "check your inbox" — the code
          // still exists (terminal fallback), so the request is not an error.
          return reply.send({
            success: true,
            emailSent: false,
            message: 'We could not send the email right now. Please try again in a few minutes or contact support.'
          });
        }
      } else {
        console.log(`[Auth-Mock] SMTP not configured. Use terminal fallback code above.`);
      }
      return reply.send({ success: true, emailSent: smtpConfigured(), message: 'Verification code sent. If it is not in your inbox within a minute, check your spam or junk folder.' });
    } catch (err: any) {
      console.error('[Auth] Internal Request Error:', err.message);
      return reply.code(500).send({ error: `Verification failed: ${err.message}` });
    }
  });

  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, name, verificationCode, accountType } = request.body as any;

    if (!email || !password || !verificationCode) {
      return reply.code(400).send({ error: 'Email, password, and verification code are required' });
    }
    const isBusiness = String(accountType || '').toLowerCase() === 'business';
    let business: BusinessDetails | undefined;
    if (isBusiness) {
      if (isFreeMailDomain(email)) return reply.code(400).send({ error: 'Business accounts need a company email address.' });
      const parsed = readBusinessDetails(request.body);
      if (parsed.error) return reply.code(400).send({ error: parsed.error });
      business = parsed.details;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { email, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return reply.code(400).send({ error: 'You have a pending invitation. Please use the invite link to join your organization.' });
    }

    const record = verificationCodes.get(email);
    if (!record || record.code !== verificationCode) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }
    if (Date.now() > record.expiresAt) {
      verificationCodes.delete(email);
      return reply.code(400).send({ error: 'Verification code has expired' });
    }

    // Code is valid
    verificationCodes.delete(email);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use a transaction to ensure both user and org are created together
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create a default Organization for the user
      const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
      const org = await tx.organization.create({
        data: {
          name: business ? business.companyName : name ? `${name}'s Workspace` : `${email.split('@')[0]}'s Workspace`,
          slug: orgSlug,
          ...(business ? {
            accountType: 'BUSINESS',
            businessNumber: business.businessNumber,
            companyEmail: email,
            website: business.website || null,
            addressLine: business.addressLine,
            city: business.city,
            state: business.state || null,
            country: business.country,
            postalCode: business.postalCode || null,
          } : {}),
        }
      });

      // 2. Create the workspace owner.
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'OWNER',
          organizationId: org.id,
          allowedDeviceIds: ['__all__']
        }
      });

      // 3. Create the TRIAL subscription for the new owner. The length is the
      // (possibly super-admin-overridden) TRIAL plan's trialDays, exactly as
      // the Google sign-up path does — a hard-coded 15 here ignored the override.
      const trialMs = trialDurationMs(await getTrialDays());
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: 'TRIAL',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + trialMs)
        }
      });

      return { user, org };
    });

    const { user } = result;

    await recordActivity(
      result.org.id,
      'ORG_CREATED',
      `Organization created by ${user.name || user.email}`,
      { id: user.id, name: user.name || user.email },
    );

    // Notify other services that a user was created
    await publishEvent({
      channel: EventChannel.USER_CREATED,
      payload: { userId: user.id, email: user.email }
    });

    // Welcome email (never blocks or fails the sign-up).
    sendWelcomeEmail(user).catch((err: any) => console.warn('[Auth] Welcome email failed:', err?.message || err));

    // Create Stripe Customer
    try {
      const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';
      await fetch(`${billingUrl}/billing/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      });
    } catch (err) {
      console.error('[Auth] Failed to trigger billing customer creation:', err);
    }

    return reply.send(await issueTokensForRequest(user, request));
  });

  // 5. Verify Invitation Token
  fastify.get('/invitation/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } }
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired invitation' });
    }

    return reply.send({ email: invitation.email, role: invitation.role, orgName: invitation.organization.name });
  });

  // 6. Complete Onboarding (Set Password for Invited Member)
  fastify.post('/onboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password, name } = request.body as any;
    if (!token || !password) return reply.code(400).send({ error: 'Token and password are required' });

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true }
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired invitation' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Upsert: update existing user if email already exists, otherwise create
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    const allowedGroupIds = Array.isArray((invitation as any).allowedGroupIds)
      ? (invitation as any).allowedGroupIds
      : [];
    const allowedGroups = allowedGroupIds.length > 0
      ? await prisma.deviceGroup.findMany({
          where: { id: { in: allowedGroupIds }, orgId: invitation.organizationId },
          select: { id: true }
        })
      : [];
    const allowedGroupConnect = allowedGroups.map((group) => ({ id: group.id }));

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { email: invitation.email },
        data: {
          password: hashedPassword,
          name: name || existingUser.name || invitation.email.split('@')[0],
          role: invitation.role,
          organizationId: invitation.organizationId,
          departmentId: invitation.departmentId,
          allowedTags: invitation.allowedTags,
          allowedDeviceIds: (invitation as any).allowedDeviceIds || [],
          allowedGroups: { set: allowedGroupConnect }
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          name: name || invitation.email.split('@')[0],
          role: invitation.role,
          organizationId: invitation.organizationId,
          departmentId: invitation.departmentId,
          allowedTags: invitation.allowedTags,
          allowedDeviceIds: (invitation as any).allowedDeviceIds || [],
          allowedGroups: allowedGroupConnect.length > 0 ? { connect: allowedGroupConnect } : undefined
        }
      });
    }

    // Delete used invitation
    await prisma.invitation.delete({ where: { id: invitation.id } });

    await recordActivity(
      invitation.organizationId,
      'MEMBER_JOINED',
      `${user.name || user.email} joined the organization`,
      { id: user.id, name: user.name || user.email },
    );

    // Notify signaling for real-time team update
    try {
      await redisPublisher.publish(EventChannel.ORG_UPDATES, JSON.stringify({
        type: 'member-onboarded',
        organizationId: invitation.organizationId
      }));
    } catch (err) {
      console.error('[Auth-Service] Failed to publish member-onboarded event:', err);
    }

    return reply.send(await issueTokensForRequest(user, request));
  });

  // Google Sign-In (Mobile & Web)
  fastify.post('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const { idToken } = request.body as any;
    if (!idToken) return reply.code(400).send({ error: 'ID token required' });

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) return reply.code(400).send({ error: 'Invalid Google token' });

      const { email, name } = payload;

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Auto-create account for new Google users
        const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
        const result = await prisma.$transaction(async (tx: any) => {
          const org = await tx.organization.create({
            data: {
              name: `${name || email.split('@')[0]}'s Workspace`,
              slug: orgSlug,
            }
          });
          const newUser = await tx.user.create({
            data: {
              email,
              name: name || email.split('@')[0],
              role: 'OWNER',
              organizationId: org.id,
              allowedDeviceIds: ['__all__']
            }
          });
          return { user: newUser };
        });
        user = result.user;

        await publishEvent({ channel: EventChannel.USER_CREATED, payload: { userId: user!.id, email: user!.email } });

        try {
          const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';
          await fetch(`${billingUrl}/billing/create-customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user!.id, email: user!.email })
          });
        } catch (err) { }
      }

      const googleBlock = await getAccountBlock(user!);
      if (googleBlock) {
        return reply.code(403).send(googleBlock);
      }

      const googleGate = await twoFactorGate(user);
      if (googleGate?.kind === 'verify') {
        return reply.send({ twoFactorRequired: true, tempToken: googleGate.tempToken });
      }
      if (googleGate?.kind === 'setup') {
        await recordLogin({ userId: user!.id, email: user!.email, ip: requestIp(request), userAgent: (request.headers['user-agent'] as string) || null, result: 'TWO_FACTOR_SETUP' });
        return reply.code(403).send({ error: TWO_FACTOR_SETUP_MESSAGE, twoFactorSetupRequired: true, tempToken: googleGate.tempToken });
      }

      await recordLogin({ userId: user!.id, email: user!.email, ip: requestIp(request), userAgent: (request.headers['user-agent'] as string) || null, result: 'SUCCESS' });
      return reply.send(await issueTokensForRequest(user!, request));
    } catch (err: any) {
      console.error('[Auth] Google token verification failed:', err.message);
      return reply.code(401).send({ error: 'Google authentication failed' });
    }
  });

  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;
    const ip = requestIp(request);
    const userAgent = (request.headers['user-agent'] as string) || null;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      await recordLogin({ userId: user?.id ?? null, email, ip, userAgent, result: 'NO_ACCOUNT' });
      // A sign-up that never entered its code has no account yet: say so, and
      // let the client return to the code screen without issuing a new code.
      const pending = !user ? verificationCodes.get(email) : undefined;
      if (pending && pending.expiresAt > Date.now()) {
        return reply.code(401).send({ error: 'Your sign-up is not finished yet. Enter the verification code we emailed you.', pendingVerification: true });
      }
      return reply.code(401).send({ error: 'Account does not exist in the system' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordLogin({ userId: user.id, email, ip, userAgent, result: 'INCORRECT_PASSWORD' });
      return reply.code(401).send({ error: 'Incorrect password' });
    }

    const loginBlock = await getAccountBlock(user);
    if (loginBlock) {
      await recordLogin({ userId: user.id, email, ip, userAgent, result: 'SUSPENDED' });
      return reply.code(403).send(loginBlock);
    }

    const gate = await twoFactorGate(user);
    if (gate?.kind === 'verify') {
      await recordLogin({ userId: user.id, email, ip, userAgent, result: 'TWO_FACTOR' });
      return reply.send({ twoFactorRequired: true, tempToken: gate.tempToken });
    }
    if (gate?.kind === 'setup') {
      // Refused (403) rather than a 200 without tokens, so a client that does
      // not know this step (the mobile app) shows the message instead of
      // treating the reply as a sign-in.
      await recordLogin({ userId: user.id, email, ip, userAgent, result: 'TWO_FACTOR_SETUP' });
      return reply.code(403).send({ error: TWO_FACTOR_SETUP_MESSAGE, twoFactorSetupRequired: true, tempToken: gate.tempToken });
    }

    await recordLogin({ userId: user.id, email, ip, userAgent, result: 'SUCCESS' });
    return reply.send(await issueTokensForRequest(user, request));
  });

  // The org requires 2FA and this account has none: the sign-in's setup temp
  // token stands in for a session. Start issues the secret + QR code, confirm
  // checks the first code, turns 2FA on and completes the sign-in.
  const readSetupToken = (tempToken: unknown) => {
    const decoded = typeof tempToken === 'string' ? verifyToken(tempToken) : null;
    return decoded && decoded.userId && decoded.type === '2fa-setup' ? decoded : null;
  };

  fastify.post('/setup-2fa', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tempToken } = (request.body || {}) as any;
    const decoded = readSetupToken(tempToken);
    if (!decoded) return reply.code(401).send({ error: 'Invalid or expired 2FA setup session' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if ((user as any).is2FAEnabled) return reply.code(400).send({ error: '2FA is already set up. Sign in again.' });

    const secret = totp.generateSecret();
    const otpauth = totp.toURI({ label: user.email, issuer: 'Remote 365', secret });
    const qrCode = await QRCode.toDataURL(otpauth);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
    return reply.send({ qr_code: qrCode });
  });

  fastify.post('/verify-2fa-setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, tempToken } = (request.body || {}) as any;
    if (!code) return reply.code(400).send({ error: 'Verification code required' });
    const decoded = readSetupToken(tempToken);
    if (!decoded) return reply.code(401).send({ error: 'Invalid or expired 2FA setup session' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !(user as any).twoFactorSecret) return reply.code(400).send({ error: '2FA not initialized' });
    if ((user as any).is2FAEnabled) return reply.code(400).send({ error: '2FA is already set up. Sign in again.' });

    const isValid = totp.verify(String(code), { secret: (user as any).twoFactorSecret });
    if (!isValid) return reply.code(401).send({ error: 'Invalid verification code' });

    const loginBlock = await getAccountBlock(user);
    if (loginBlock) return reply.code(403).send(loginBlock);

    const enabled = await prisma.user.update({ where: { id: user.id }, data: { is2FAEnabled: true } });
    await recordLogin({ userId: user.id, email: user.email, ip: requestIp(request), userAgent: (request.headers['user-agent'] as string) || null, result: 'SUCCESS' });
    return reply.send(await issueTokensForRequest(enabled, request));
  });

  fastify.post('/verify-2fa', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, tempToken } = request.body as any;
    if (!code || !tempToken) return reply.code(400).send({ error: 'Code and tempToken required' });

    const decoded = verifyToken(tempToken);
    if (!decoded || !decoded.userId || decoded.type !== '2fa-temp') {
      return reply.code(401).send({ error: 'Invalid or expired 2FA session' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !(user as any).twoFactorSecret) return reply.code(400).send({ error: '2FA not set up' });

    const isValid = totp.verify(code, { secret: (user as any).twoFactorSecret });
    if (!isValid) return reply.code(401).send({ error: 'Invalid 2FA code' });

    await recordLogin({ userId: user.id, email: user.email, ip: requestIp(request), userAgent: (request.headers['user-agent'] as string) || null, result: 'SUCCESS' });
    return reply.send(await issueTokensForRequest(user, request));
  });

  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token required' });

    // Check if blacklisted in Redis
    const isBlacklisted = await isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      return reply.code(401).send({ error: 'Session expired or logged out' });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded || !decoded.userId || decoded.type !== 'refresh') {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
    if (decoded.sid) {
      const revoked = await redisPublisher.exists(authSessionRevokedKey(decoded.userId, decoded.sid));
      if (revoked) return reply.code(401).send({ error: 'Session revoked' });
      const sessionExists = await redisPublisher.exists(authSessionKey(decoded.userId, decoded.sid));
      if (!sessionExists) return reply.code(401).send({ error: 'Session expired or logged out' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    const refreshBlock = await getAccountBlock(user);
    if (refreshBlock) {
      return reply.code(403).send(refreshBlock);
    }

    return reply.send(await issueTokensForRequest(user, request, decoded.sid));
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token required' });

    const decoded = verifyToken(refreshToken);
    if (decoded && decoded.exp) {
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await blacklistToken(refreshToken, ttl);
      }
      if (decoded.userId && decoded.sid) {
        await redisPublisher.del(authSessionKey(decoded.userId, decoded.sid));
        await redisPublisher.srem(authSessionIndexKey(decoded.userId), decoded.sid);
        await redisPublisher.set(authSessionRevokedKey(decoded.userId, decoded.sid), '1', 'EX', AUTH_SESSION_TTL_SECONDS);
      }
    }

    return reply.send({ success: true });
  });

  // 5. Get Current User (The missing /me endpoint)
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    // Single-session policy: a newer sign-in elsewhere revokes this session,
    // and the client is kicked out on its next check here.
    if (decoded.sid) {
      const revoked = await redisPublisher.exists(authSessionRevokedKey(decoded.userId, decoded.sid));
      if (revoked) {
        return reply.code(401).send({ error: 'You have been signed out because this account signed in on another device.', sessionRevoked: true });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { subscription: true }
    });

    if (!user) return reply.code(404).send({ error: 'User not found' });

    const meBlock = await getAccountBlock(user);
    if (meBlock) {
      return reply.code(403).send(meBlock);
    }

    // Owner-configured feature visibility for this member's role. Owners/super
    // admins always get everything; ADMIN/VIEWER inherit the org's roleFeatures.
    let orgRoleFeatures: any = {};
    if (user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { roleFeatures: true }
      });
      orgRoleFeatures = (org as any)?.roleFeatures || {};
    }
    // Resolve the effective picture (sidebar features + RBAC permissions) after
    // applying this user's per-user overrides on top of the role/org defaults.
    const { features, permissions } = resolveEffectivePermissions(
      user.role,
      orgRoleFeatures,
      (user as any).permissionOverrides,
    );

    const effectiveSub: any = await resolveEffectiveSubscription(user);

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: (effectiveSub as any)?.customPlanKey || effectiveSub?.plan || 'TRIAL',
      status: effectiveSub?.status || 'ACTIVE',
      currentPeriodEnd: effectiveSub?.currentPeriodEnd,
      role: user.role,
      features,
      permissions,
      organizationId: user.organizationId,
      allowedTags: user.allowedTags,
      hasPassword: !!user.password,
      provider: user.password ? 'local' : 'google',
      avatar: (user as any).avatar || null,
      language: (user as any).language || 'en',
      is_2fa_enabled: (user as any).is2FAEnabled ?? false,
      notify_session_alert: (user as any).notifySessionAlert ?? true,
      notify_disconnect_alert: (user as any).notifyDisconnectAlert ?? true,
      notify_sound_effects: (user as any).notifySoundEffects ?? true,
      darkMode: (user as any).darkMode ?? false,
      searchBehavior: (user as any).searchBehavior || 'Search for result',
      useNewInterface: (user as any).useNewInterface ?? true,
      marketingMessages: (user as any).marketingMessages ?? false,
      fontSize: (user as any).fontSize ?? 16,
      startWithWindows: (user as any).startWithWindows ?? false,
      useDeviceDock: (user as any).useDeviceDock ?? false,
      keepAgentRunning: (user as any).keepAgentRunning ?? true,
      updatesAutomatically: (user as any).updatesAutomatically ?? true,
      windowsNotification: (user as any).windowsNotification ?? true,
      incomingSessionNotification: (user as any).incomingSessionNotification ?? true,
      security_settings: (user as any).securitySettings || null
    });
  });

  // 5.1 List Active Sessions
  fastify.get('/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    const currentSessionId = decoded.sid || legacySessionIdFromToken(token);
    await saveAuthSession(user, currentSessionId, request);

    const sessionIds = await redisPublisher.smembers(authSessionIndexKey(decoded.userId));
    const keys = sessionIds.map((id: string) => authSessionKey(decoded.userId, id));
    const rows = keys.length > 0 ? await redisPublisher.mget(...keys) : [];
    const sessions = rows
      .map((row: string | null, index: number) => row ? { ...JSON.parse(row), id: sessionIds[index] } : null)
      .filter(Boolean)
      .map((session: any) => ({
        id: session.id,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastSeen: session.lastSeen,
        isCurrent: session.id === currentSessionId
      }))
      .sort((a: any, b: any) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    const missingSessionIds = sessionIds.filter((_: string, index: number) => !rows[index]);
    if (missingSessionIds.length > 0) {
      await redisPublisher.srem(authSessionIndexKey(decoded.userId), ...missingSessionIds);
    }

    return reply.send(sessions);
  });

  // 5.2 Revoke Session
  fastify.delete('/sessions/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { sessionId } = request.params as { sessionId: string };
    await redisPublisher.del(authSessionKey(decoded.userId, sessionId));
    await redisPublisher.srem(authSessionIndexKey(decoded.userId), sessionId);
    await redisPublisher.set(authSessionRevokedKey(decoded.userId, sessionId), '1', 'EX', AUTH_SESSION_TTL_SECONDS);
    return reply.send({ success: true });
  });


  // 6. Update Profile/Password
  fastify.patch('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const {
      name,
      current_password,
      password,
      notify_session_alert,
      notify_disconnect_alert,
      notify_sound_effects,
      language,
      avatar,
      darkMode,
      searchBehavior,
      useNewInterface,
      marketingMessages,
      fontSize,
      startWithWindows,
      useDeviceDock,
      keepAgentRunning,
      updatesAutomatically,
      windowsNotification,
      incomingSessionNotification,
      security_settings
    } = request.body as any;

    const updateData: any = {};

    if (name) updateData.name = name;

    if (notify_session_alert !== undefined) updateData.notifySessionAlert = notify_session_alert;
    if (notify_disconnect_alert !== undefined) updateData.notifyDisconnectAlert = notify_disconnect_alert;
    if (notify_sound_effects !== undefined) updateData.notifySoundEffects = notify_sound_effects;
    if (language) updateData.language = normalizeLanguage(language);
    if (avatar !== undefined) updateData.avatar = avatar;
    if (darkMode !== undefined) updateData.darkMode = darkMode;
    if (searchBehavior) updateData.searchBehavior = searchBehavior;
    if (useNewInterface !== undefined) updateData.useNewInterface = useNewInterface;
    if (marketingMessages !== undefined) updateData.marketingMessages = marketingMessages;
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (startWithWindows !== undefined) updateData.startWithWindows = Boolean(startWithWindows);
    if (useDeviceDock !== undefined) updateData.useDeviceDock = Boolean(useDeviceDock);
    if (keepAgentRunning !== undefined) updateData.keepAgentRunning = Boolean(keepAgentRunning);
    if (updatesAutomatically !== undefined) updateData.updatesAutomatically = Boolean(updatesAutomatically);
    if (windowsNotification !== undefined) updateData.windowsNotification = Boolean(windowsNotification);
    if (incomingSessionNotification !== undefined) updateData.incomingSessionNotification = Boolean(incomingSessionNotification);
    if (security_settings !== undefined) {
      const sanitized = sanitizeSecuritySettings(security_settings);
      if (!sanitized) return reply.code(400).send({ error: 'Invalid security settings' });
      updateData.securitySettings = sanitized;
    }

    if (password) {
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });

      if (user.password) {
        if (!current_password) return reply.code(400).send({ error: 'Current password required to set new password' });
        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) return reply.code(401).send({ error: 'Incorrect current password' });
      }
      // else: Google-OAuth account setting its FIRST password — there is no
      // current password to check. After this the account can sign in with
      // email+password too, and future changes require the current password.

      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData,
      include: { subscription: true }
    });

    const profileEffectiveSub: any = await resolveEffectiveSubscription(updatedUser);

    // Profile preferences (auto-update, notifications, appearance…) are
    // account-level: nudge this user's OTHER signed-in devices to re-pull /me
    // so the same setting applies everywhere without a restart. The 'features'
    // scope is what App.tsx already handles with a checkAuth() refresh.
    try {
      await redisPublisher.publish('account:sync', JSON.stringify({
        type: 'account-sync',
        scope: 'features',
        action: 'profile-updated',
        entityId: updatedUser.id,
        targetUserIds: [updatedUser.id],
        changedAt: new Date().toISOString()
      }));
    } catch { /* non-fatal */ }

    return reply.send({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        // Keep this payload shape-complete with GET /me: the client stores it
        // as the whole user, so omitting role/org used to wipe role-gated UI.
        role: updatedUser.role,
        organizationId: updatedUser.organizationId,
        allowedTags: updatedUser.allowedTags,
        plan: (profileEffectiveSub as any)?.customPlanKey || profileEffectiveSub?.plan || 'TRIAL',
        status: profileEffectiveSub?.status || 'ACTIVE',
        currentPeriodEnd: profileEffectiveSub?.currentPeriodEnd,
        hasPassword: !!updatedUser.password,
        provider: updatedUser.password ? 'local' : 'google',
        avatar: (updatedUser as any).avatar || null,
        language: (updatedUser as any).language || 'en',
        is_2fa_enabled: (updatedUser as any).is2FAEnabled ?? false,
        notify_session_alert: (updatedUser as any).notifySessionAlert ?? true,
        notify_disconnect_alert: (updatedUser as any).notifyDisconnectAlert ?? true,
        notify_sound_effects: (updatedUser as any).notifySoundEffects ?? true,
        darkMode: (updatedUser as any).darkMode ?? false,
        searchBehavior: (updatedUser as any).searchBehavior || 'Search for result',
        useNewInterface: (updatedUser as any).useNewInterface ?? true,
        marketingMessages: (updatedUser as any).marketingMessages ?? false,
        fontSize: (updatedUser as any).fontSize ?? 16,
        startWithWindows: (updatedUser as any).startWithWindows ?? false,
        useDeviceDock: (updatedUser as any).useDeviceDock ?? false,
        keepAgentRunning: (updatedUser as any).keepAgentRunning ?? true,
        updatesAutomatically: (updatedUser as any).updatesAutomatically ?? true,
        windowsNotification: (updatedUser as any).windowsNotification ?? true,
        incomingSessionNotification: (updatedUser as any).incomingSessionNotification ?? true,
        security_settings: (updatedUser as any).securitySettings || null
      }
    });
  });

  // 6.1 Close Account (Complete Wipe)
  fastify.delete('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const userId = decoded.userId;

    try {
      await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { organization: true }
        });

        if (!user) throw new Error('User not found');

        // 1. If this is the last user in an organization, clean up the org too.
        const shouldDeleteOrg = user.organizationId
          ? await tx.user.count({ where: { organizationId: user.organizationId } }) <= 1
          : false;

        if (shouldDeleteOrg && user.organizationId) {
          const orgId = user.organizationId;

          // Dissociate other users first (standard cleanup)
          // 1. Delete all other members of this organization
          const subordinates = await tx.user.findMany({
            where: { organizationId: orgId, NOT: { id: userId } },
            select: { id: true }
          });
          const subordinateIds = subordinates.map((s: any) => s.id);
          console.log(`[Auth-Service] Cascading Delete: Found ${subordinateIds.length} subordinates for Org ${orgId}`);

          if (subordinateIds.length > 0) {
            // Clean up subordinate data
            const subDevices = await tx.device.findMany({ where: { ownerId: { in: subordinateIds } } });
            const subDeviceIds = subDevices.map((d: any) => d.id);

            await tx.trustedDevice.deleteMany({
              where: { OR: [{ viewerUserId: { in: subordinateIds } }, { hostDeviceId: { in: subDeviceIds } }] }
            });
            await tx.savedDevice.deleteMany({
              where: { OR: [{ userId: { in: subordinateIds } }, { deviceId: { in: subDeviceIds } }] }
            });
            await tx.session.deleteMany({
              where: { OR: [{ viewerId: { in: subordinateIds } }, { hostId: { in: subDeviceIds } }] }
            });
            await tx.device.deleteMany({ where: { ownerId: { in: subordinateIds } } });
            await tx.subscription.deleteMany({ where: { userId: { in: subordinateIds } } });
            await tx.supportTicket.deleteMany({ where: { userId: { in: subordinateIds } } });
            await tx.guideRequest.deleteMany({ where: { userId: { in: subordinateIds } } });

            // Chat + remote-session relations don't cascade from User; clean them up
            await tx.message.deleteMany({ where: { senderId: { in: subordinateIds } } });
            await tx.conversationParticipant.deleteMany({ where: { userId: { in: subordinateIds } } });
            await tx.remoteSessionCollaborator.deleteMany({ where: { userId: { in: subordinateIds } } });

            // Delete the subordinate users themselves
            await tx.user.deleteMany({ where: { id: { in: subordinateIds } } });
            console.log(`[Auth-Service] Cascading Delete: ${subordinateIds.length} subordinate users removed.`);
          }

          // 2. Clean up org-level entities
          console.log(`[Auth-Service] Cascading Delete: Cleaning up Org entities for ${orgId}`);

          // 2. Clean up org-level entities
          await tx.enrollmentToken.deleteMany({ where: { organizationId: orgId } });
          await tx.invitation.deleteMany({ where: { organizationId: orgId } });
          await tx.department.deleteMany({ where: { organizationId: orgId } });
        }

        // 2. Clean up user-specific data
        const userDevices = await tx.device.findMany({ where: { ownerId: userId } });
        const deviceIds = userDevices.map((d: any) => d.id);

        // Remove from Trust/Saved lists (both directions)
        await tx.trustedDevice.deleteMany({
          where: { OR: [{ viewerUserId: userId }, { hostDeviceId: { in: deviceIds } }] }
        });
        await tx.savedDevice.deleteMany({
          where: { OR: [{ userId: userId }, { deviceId: { in: deviceIds } }] }
        });

        // Delete Sessions
        await tx.session.deleteMany({
          where: { OR: [{ viewerId: userId }, { hostId: { in: deviceIds } }] }
        });

        // Delete Devices
        await tx.device.deleteMany({ where: { ownerId: userId } });

        // Delete Subscription & Support
        await tx.subscription.deleteMany({ where: { userId } });
        await tx.supportTicket.deleteMany({ where: { userId } });
        await tx.guideRequest.deleteMany({ where: { userId } });

        // Chat + remote-session collaborator relations don't cascade from User; clean them up
        await tx.message.deleteMany({ where: { senderId: userId } });
        await tx.conversationParticipant.deleteMany({ where: { userId } });
        await tx.remoteSessionCollaborator.deleteMany({ where: { userId } });

        // 3. Delete the User
        await tx.user.delete({ where: { id: userId } });

        // 4. Finally delete the org if this account was the last user in it.
        if (shouldDeleteOrg && user.organizationId) {
          await tx.organization.delete({ where: { id: user.organizationId } });
        }
      });

      return reply.send({ success: true, message: 'Account closed and all data wiped.' });
    } catch (err: any) {
      console.error('[Auth-Service] Account closure failed:', err);
      return reply.code(500).send({ error: 'Failed to close account' });
    }
  });

  // 7. Get ICE Servers (STUN/TURN) for WebRTC
  fastify.get('/ice-servers', async (request: FastifyRequest, reply: FastifyReply) => {
    // Normally the caller is a signed-in user. The exception is an UNATTENDED
    // host: a PC sitting at the Windows sign-in screen has no signed-in user
    // and therefore no access token, but it still needs TURN — without a relay
    // it would register as Online and then fail every connection on any network
    // that can't do peer-to-peer. It authenticates with its machine credential
    // instead (accessKey + hostSecret, see POST /api/devices/host-credential).
    const authHeader = request.headers.authorization;
    let turnIdentity = '';
    if (authHeader) {
      const decoded = verifyToken(authHeader.split(' ')[1]);
      if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });
      turnIdentity = decoded.userId;
    } else {
      const key = String(request.headers['x-device-key'] || '').replace(/\s/g, '');
      const hostSecret = request.headers['x-host-secret'];
      if (!key || !hostSecret) return reply.code(401).send({ error: 'Unauthorized' });
      const device = await prisma.device.findUnique({
        where: { accessKey: key },
        select: { id: true, hostSecretHash: true }
      });
      if (!device || !hostSecretMatches(hostSecret, (device as any).hostSecretHash)) {
        return reply.code(401).send({ error: 'Invalid host credential' });
      }
      // TURN usernames are opaque; scope this one to the device so relay usage
      // is still attributable.
      turnIdentity = `device:${device.id}`;
    }

    const serverHost = process.env.TURN_HOST || process.env.SERVER_IP || '159.65.84.190';
    const turnSecret = process.env.TURN_REST_SECRET;
    const staticTurnUser = process.env.TURN_USER;
    const staticTurnPassword = process.env.TURN_PASSWORD;
    const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 3600);
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(300, Math.min(ttlSeconds, 86400));
    const turnUsername = `${expiresAt}:${turnIdentity}`;
    const turnPassword = turnSecret
      ? createHmac('sha1', turnSecret).update(turnUsername).digest('base64')
      : null;

    const iceServers: any[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    if (turnPassword) {
      iceServers.push({
        urls: [`turn:${serverHost}:3478?transport=udp`, `turn:${serverHost}:3478?transport=tcp`],
        username: turnUsername,
        credential: turnPassword,
        credentialType: 'password'
      });
    } else if (staticTurnUser && staticTurnPassword) {
      iceServers.push({
        urls: [`turn:${serverHost}:3478?transport=udp`, `turn:${serverHost}:3478?transport=tcp`],
        username: staticTurnUser,
        credential: staticTurnPassword,
        credentialType: 'password'
      });
    }

    // --- Cloudflare global TURN (anycast) -----------------------------------
    // For a worldwide launch, a single London coturn forces far-away users to
    // relay through the UK (the #1 latency cause for non-P2P sessions).
    // Cloudflare's TURN is anycast, so every user reaches a *nearby* relay.
    // Enabled only when CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN are
    // set; otherwise behaviour is unchanged. Returned FIRST so ICE prefers it
    // over the London coturn, which stays as a fallback.
    // The credential is cached process-wide (see @remotelink/shared) so this
    // no longer pays a Cloudflare HTTPS round-trip on every session start.
    const cfEntry = await getCloudflareTurnEntry(request.log);
    if (cfEntry) iceServers.unshift(cfEntry);

    return reply.send({
      iceServers,
      expiresAt: turnPassword ? expiresAt : null
    });
  });

  // 8. Effective recording policy for the calling user (any authenticated role).
  // The super admin sets platform-wide policies (admin-settings.ts); viewers ask
  // here at session start and enforce them client-side: auto-record mode, the
  // recorder's bitrate tier, watermarking, and whether this user may save
  // (download) recordings at all. Recordings save to the viewer's own disk
  // today, so "download" == the whole Record control.
  fastify.get('/recording-policy', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });

    const settings = await prisma.platformSettings.findFirst();
    const role = String(decoded.role || 'VIEWER').toUpperCase();
    const isAdminRole = ['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(role);
    return reply.send({
      autoRecord: settings?.recordingAutoRecord ?? 'never',
      quality: settings?.recordingQuality ?? '1080p',
      watermark: settings?.recordingWatermark ?? true,
      canDownload: (settings?.recordingOnlyAdminsDownload ?? true) ? isAdminRole : true,
    });
  });
}
