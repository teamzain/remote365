import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomInt } from 'crypto';

// Load .env BEFORE any other imports to ensure Prisma finds DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { prisma, redisPublisher, redisSubscriber, EventChannel, getPlanLimits, verifyToken, hasPermission } from '@remotelink/shared';

const SUPPORT_SESSION_TTL_SEC = Number(process.env.SUPPORT_SESSION_TTL_MINUTES || 30) * 60;
const SUPPORT_SESSION_ACTIVE_STATUSES = ['CREATED', 'QUEUED', 'ASSIGNED', 'RINGING', 'CONNECTED'];
const supportSessions = (prisma as any).supportSession;
const CREATED_STATUSES = ['CREATED', 'QUEUED'];
const TERMINAL_STATUSES = ['EXPIRED', 'ENDED', 'RESOLVED'];

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
};

const getOrgScope = (user: AuthUser) => user.organizationId || `user:${user.id}`;
const canViewAllSupportSessions = (user: AuthUser) => hasPermission(user.role, 'support:viewAll');
const canViewAssignedSupportSessions = (user: AuthUser) => hasPermission(user.role, 'support:viewAssigned');
const canAssignSupportSessions = (user: AuthUser) => hasPermission(user.role, 'support:assign');
const canUpdateSupportSessions = (user: AuthUser) => hasPermission(user.role, 'support:updateStatus');
const canCloseSupportSessions = (user: AuthUser) => hasPermission(user.role, 'support:close');
const isTechnician = (user: AuthUser) => user.role === 'TECHNICIAN';
const getExpiresAt = (session: any) =>
  new Date(new Date(session.createdAt).getTime() + SUPPORT_SESSION_TTL_SEC * 1000);

const sanitizePin = (pin: unknown) => String(pin || '').replace(/\D/g, '').slice(0, 4);
const sanitizeText = (value: unknown, max = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : undefined;

const generateDigits = (length: number) => {
  let value = '';
  for (let index = 0; index < length; index += 1) value += randomInt(0, 10).toString();
  return value;
};

const generateUniqueCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateDigits(9);
    const existing = await supportSessions.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Could not generate unique support session code');
};

const decorateSession = (session: any) => ({
  ...session,
  expiresAt: getExpiresAt(session).toISOString(),
});

const publishSupportSessionUpdate = async (type: string, session: any) => {
  await redisPublisher.publish(EventChannel.SUPPORT_SESSION_UPDATES, JSON.stringify({
    type,
    orgId: session.orgId,
    sessionId: session.id,
    status: session.status,
    changedAt: new Date().toISOString(),
  }));
};

const sweepExpiredSupportSessions = async (orgId?: string) => {
  const cutoff = new Date(Date.now() - SUPPORT_SESSION_TTL_SEC * 1000);
  const where: any = {
    status: { in: ['CREATED', 'QUEUED'] },
    createdAt: { lt: cutoff },
  };
  if (orgId) where.orgId = orgId;

  const expiring = await supportSessions.findMany({ where, select: { id: true, orgId: true, status: true } });
  if (expiring.length === 0) return;

  await supportSessions.updateMany({
    where: { id: { in: expiring.map((session: any) => session.id) } },
    data: { status: 'EXPIRED', endedAt: new Date() },
  });

  await Promise.all(expiring.map((session: any) =>
    publishSupportSessionUpdate('session.expired', { ...session, status: 'EXPIRED' })
  ));
};

const requireSupportSessionAccess = async (sessionId: string, user: AuthUser, mode: 'detail' | 'assigned' | 'member-or-tech' | 'manager-or-participant') => {
  const session = await supportSessions.findUnique({ where: { id: sessionId } });
  if (!session || session.orgId !== getOrgScope(user)) return null;

  const ownCustomerSession = session.customerUserId === user.id;
  const assignedTechnician = session.technicianId === user.id;

  if (mode === 'assigned') return assignedTechnician && canViewAssignedSupportSessions(user) ? session : null;
  if (mode === 'detail') {
    if (ownCustomerSession || (assignedTechnician && canViewAssignedSupportSessions(user)) || canViewAllSupportSessions(user)) return session;
    return null;
  }
  if (mode === 'manager-or-participant') {
    if (ownCustomerSession || (assignedTechnician && canViewAssignedSupportSessions(user)) || canCloseSupportSessions(user)) return session;
    return null;
  }
  if (ownCustomerSession || (assignedTechnician && canViewAssignedSupportSessions(user))) return session;
  return null;
};

const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const path = request.url.split('?')[0];
  if (path === '/api/session/health' || path === '/api/sessions/health') return;

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized' });

  const decoded = verifyToken(authHeader.slice('Bearer '.length));
  if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, role: true, organizationId: true },
  }) as AuthUser | null;

  if (!user) return reply.code(401).send({ error: 'User not found' });
  (request as any).user = user;
};

const registerSupportSessionRoutes = async (server: any) => {
  server.get('/api/session/health', async () => ({ status: 'ok', service: 'session-service' }));
  server.get('/api/sessions/health', async () => ({ status: 'ok', service: 'session-service' }));

  server.addHook('preHandler', authenticate);

  server.get('/api/sessions/technicians', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    if (!hasPermission(user.role, 'support:create') && !canViewAllSupportSessions(user)) {
      return reply.code(403).send({ error: 'Support access required' });
    }

    const orgId = user.organizationId;
    if (!orgId) return reply.send({ technicians: [] });

    const technicians = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });

    return reply.send({ technicians });
  });

  server.post('/api/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    if (!hasPermission(user.role, 'support:create')) {
      return reply.code(403).send({ error: 'Support session creation access required' });
    }

    const body = (request.body || {}) as any;
    const code = await generateUniqueCode();
    const pin = generateDigits(4);
    const orgId = getOrgScope(user);
    const requestedDeviceId = sanitizeText(body.deviceId, 160);
    const requestedTechnicianId = sanitizeText(body.technicianId, 160);
    let deviceName = sanitizeText(body.deviceName, 200);
    let technicianId: string | undefined;

    if (requestedDeviceId && user.organizationId) {
      const device = await prisma.device.findFirst({
        where: {
          id: requestedDeviceId,
          organizationId: user.organizationId,
          OR: [
            { ownerId: user.id },
            { savedByUsers: { some: { userId: user.id } } },
            // Device is in an org device group this user has been granted.
            { groups: { some: { members: { some: { id: user.id } } } } },
          ],
        } as any,
        select: { id: true, name: true, accessKey: true },
      });
      if (!device) return reply.code(400).send({ error: 'Selected device is not available to this user' });
      const cleanKey = String(device.accessKey || '').replace(/\D/g, '');
      const formattedKey = cleanKey.length === 9 ? `${cleanKey.slice(0, 3)} ${cleanKey.slice(3, 6)} ${cleanKey.slice(6)}` : cleanKey;
      deviceName = device.name || (formattedKey ? `Device ${formattedKey}` : undefined);
    }

    if (requestedTechnicianId) {
      if (!user.organizationId) return reply.code(400).send({ error: 'Technician assignment requires an organization' });
      const technician = await prisma.user.findFirst({
        where: {
          id: requestedTechnicianId,
          organizationId: user.organizationId,
          role: 'TECHNICIAN',
        },
        select: { id: true },
      });
      if (!technician) return reply.code(400).send({ error: 'Selected technician is not available in this organization' });
      technicianId = technician.id;
    }

    const session = await supportSessions.create({
      data: {
        code,
        pin,
        status: technicianId ? 'ASSIGNED' : 'CREATED',
        orgId,
        customerUserId: user.id,
        customerName: sanitizeText(body.customerName, 160) || user.name || user.email,
        customerEmail: sanitizeText(body.customerEmail, 320) || user.email,
        technicianId,
        deviceId: requestedDeviceId || null,
        deviceName: deviceName || null,
        issueCategory: sanitizeText(body.issueCategory, 80),
        issueSummary: sanitizeText(body.issueSummary, 1000),
        acceptedAt: technicianId ? new Date() : null,
      },
    });

    await redisPublisher.set(`support-session:${session.id}:ttl`, '1', 'EX', SUPPORT_SESSION_TTL_SEC);
    await publishSupportSessionUpdate('session.created', session);

    return reply.code(201).send(decorateSession(session));
  });

  server.get('/api/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const query = (request.query || {}) as { status?: string; assignedToMe?: string };
    const orgId = getOrgScope(user);
    await sweepExpiredSupportSessions(orgId);

    const requestedStatuses = query.status
      ?.split(',')
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean);

    const where: any = { orgId };
    if (requestedStatuses?.length) where.status = { in: requestedStatuses };
    if (canViewAllSupportSessions(user)) {
      if (query.assignedToMe === 'true') where.technicianId = user.id;
    } else if (canViewAssignedSupportSessions(user)) {
      if (query.assignedToMe === 'true') {
        where.technicianId = user.id;
      } else {
        where.OR = [{ technicianId: user.id }, { customerUserId: user.id }];
      }
    } else {
      where.customerUserId = user.id;
    }

    const sessions = await supportSessions.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return reply.send(sessions.map(decorateSession));
  });

  server.get('/api/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    await sweepExpiredSupportSessions(getOrgScope(user));

    const session = await requireSupportSessionAccess(id, user, 'detail');
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return reply.send(decorateSession(session));
  });

  server.post('/api/sessions/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    await sweepExpiredSupportSessions(getOrgScope(user));

    if (!isTechnician(user) || !canViewAssignedSupportSessions(user)) {
      return reply.code(403).send({ error: 'Technician support session access required' });
    }

    const current = await supportSessions.findUnique({ where: { id } });
    if (!current || current.orgId !== getOrgScope(user)) return reply.code(404).send({ error: 'Session not found' });
    if (TERMINAL_STATUSES.includes(current.status)) return reply.code(409).send({ error: 'Session is no longer active' });
    if (current.technicianId && current.technicianId !== user.id) return reply.code(409).send({ error: 'Session is assigned to another technician' });
    if (current.technicianId === user.id && current.status === 'ASSIGNED') return reply.send(decorateSession(current));
    if (!CREATED_STATUSES.includes(current.status)) return reply.code(409).send({ error: 'Session cannot be accepted from its current state' });
    if (sanitizePin(body.pin) !== current.pin) return reply.code(403).send({ error: 'Invalid PIN' });

    const session = await supportSessions.update({
      where: { id },
      data: { technicianId: user.id, status: 'ASSIGNED', acceptedAt: new Date() },
    });

    await publishSupportSessionUpdate('session.accepted', session);
    return reply.send(decorateSession(session));
  });

  server.post('/api/sessions/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    await sweepExpiredSupportSessions(getOrgScope(user));

    if (!canAssignSupportSessions(user)) return reply.code(403).send({ error: 'Support assignment access required' });
    const technicianId = sanitizeText(body.technicianId, 160);
    if (!technicianId) return reply.code(400).send({ error: 'technicianId is required' });

    const current = await supportSessions.findUnique({ where: { id } });
    if (!current || current.orgId !== getOrgScope(user)) return reply.code(404).send({ error: 'Session not found' });
    if (TERMINAL_STATUSES.includes(current.status)) return reply.code(409).send({ error: 'Completed sessions cannot be reassigned' });

    const technician = await prisma.user.findFirst({
      where: {
        id: technicianId,
        organizationId: user.organizationId || undefined,
        role: 'TECHNICIAN',
      },
      select: { id: true },
    });
    if (!technician) return reply.code(400).send({ error: 'Selected technician is not available in this organization' });

    const session = await supportSessions.update({
      where: { id },
      data: { technicianId: technician.id, status: 'ASSIGNED', acceptedAt: current.acceptedAt || new Date() },
    });

    await publishSupportSessionUpdate('session.assigned', session);
    return reply.send(decorateSession(session));
  });

  server.patch('/api/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    if (!isTechnician(user) || !canUpdateSupportSessions(user)) {
      return reply.code(403).send({ error: 'Support update access required' });
    }
    const current = await requireSupportSessionAccess(id, user, 'assigned');
    if (!current) return reply.code(404).send({ error: 'Session not found' });

    const data: any = {};
    if ('notes' in body) data.notes = sanitizeText(body.notes, 10000) || null;
    if ('issueCategory' in body) data.issueCategory = sanitizeText(body.issueCategory, 80) || null;
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'No supported fields provided' });

    const session = await supportSessions.update({ where: { id }, data });
    await publishSupportSessionUpdate('session.updated', session);
    return reply.send(decorateSession(session));
  });

  server.post('/api/sessions/:id/connected', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    if (!isTechnician(user) || !canUpdateSupportSessions(user)) {
      return reply.code(403).send({ error: 'Technician support session access required' });
    }
    const current = await requireSupportSessionAccess(id, user, 'assigned');
    if (!current) return reply.code(404).send({ error: 'Session not found' });
    if (TERMINAL_STATUSES.includes(current.status)) return reply.code(409).send({ error: 'Session is no longer active' });
    if (!['ASSIGNED', 'RINGING', 'CONNECTED'].includes(current.status)) {
      return reply.code(409).send({ error: 'Session must be assigned before it can connect' });
    }

    const session = await supportSessions.update({
      where: { id },
      data: { status: 'CONNECTED', connectedAt: current.connectedAt || new Date() },
    });

    await publishSupportSessionUpdate('session.connected', session);
    return reply.send(decorateSession(session));
  });

  server.post('/api/sessions/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const current = await requireSupportSessionAccess(id, user, 'manager-or-participant');
    if (!current) return reply.code(404).send({ error: 'Session not found' });
    const isParticipant = current.customerUserId === user.id || current.technicianId === user.id;
    if (!isParticipant && !canCloseSupportSessions(user)) {
      return reply.code(403).send({ error: 'Support close access required' });
    }
    if (TERMINAL_STATUSES.includes(current.status)) return reply.send({
      ...decorateSession(current),
      ratingPromptUrl: current.customerUserId === user.id && current.rating == null ? `/support/session/${current.id}/rate` : undefined,
    });

    const endedAt = new Date();
    const durationFrom = current.connectedAt || current.acceptedAt || current.createdAt;
    const durationSec = Math.max(0, Math.floor((endedAt.getTime() - new Date(durationFrom).getTime()) / 1000));
    const resolution = sanitizeText(body.resolution, 2000);
    const endedByTechnician = isTechnician(user) && current.technicianId === user.id;
    const notes = resolution
      ? `${current.notes ? `${current.notes}\n` : ''}[${endedAt.toISOString()}] ${endedByTechnician ? 'Resolution' : 'Customer ended'}: ${resolution}`
      : current.notes;
    const session = await supportSessions.update({
      where: { id },
      data: { status: endedByTechnician ? 'RESOLVED' : 'ENDED', endedAt, durationSec, notes },
    });

    await publishSupportSessionUpdate(endedByTechnician ? 'session.resolved' : 'session.ended', session);
    return reply.send({
      ...decorateSession(session),
      ratingPromptUrl: `/support/session/${session.id}/rate`,
    });
  });

  server.post('/api/sessions/:id/rate', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const current = await requireSupportSessionAccess(id, user, 'member-or-tech');
    if (!current || current.customerUserId !== user.id) return reply.code(404).send({ error: 'Session not found' });

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return reply.code(400).send({ error: 'Rating must be an integer from 1 to 5' });
    }

    const session = await supportSessions.update({
      where: { id },
      data: { rating, ratingComment: sanitizeText(body.comment, 2000) || null },
    });

    await publishSupportSessionUpdate('session.rated', session);
    return reply.send(decorateSession(session));
  });

  server.post('/api/sessions/:id/system-info', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const current = await requireSupportSessionAccess(id, user, 'member-or-tech');
    if (!current || (current.customerUserId !== user.id && current.technicianId !== user.id)) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    if (current.technicianId === user.id && (!isTechnician(user) || !canUpdateSupportSessions(user))) {
      return reply.code(403).send({ error: 'Support update access required' });
    }

    const body = (request.body || {}) as any;
    const systemInfo = {
      os: sanitizeText(body.os, 160),
      ram: sanitizeText(body.ram, 80),
      cpu: sanitizeText(body.cpu, 160),
      ip: sanitizeText(body.ip, 80),
      uptime: sanitizeText(body.uptime, 80),
      capturedAt: new Date().toISOString(),
    };

    const session = await supportSessions.update({ where: { id }, data: { systemInfo } });
    await publishSupportSessionUpdate('session.system-info', session);
    return reply.send(decorateSession(session));
  });
};

const registerLegacySessionListeners = () => {
  redisSubscriber.subscribe(EventChannel.SESSION_STARTED, (err: Error | null | undefined) => {
    if (err) console.error('[Session Service] Failed to subscribe to SESSION_STARTED', err);
  });

  redisSubscriber.subscribe(EventChannel.SESSION_ENDED, (err: Error | null | undefined) => {
    if (err) console.error('[Session Service] Failed to subscribe to SESSION_ENDED', err);
  });

  redisSubscriber.on('message', async (channel: string, message: string) => {
    if (channel === EventChannel.SESSION_STARTED) {
      try {
        const data = JSON.parse(message);
        console.log(`[Session Service] Session started for Host: ${data.hostId}, Viewer: ${data.viewerId}`);

        const { plan, limits } = await getPlanLimits(data.viewerId);
        const limitValue = limits?.maxConcurrentSessions ?? 1;
        const activeSessions = await prisma.session.count({
          where: { viewerId: data.viewerId, status: 'ACTIVE' },
        });

        if (activeSessions >= limitValue && limitValue !== -1) {
          console.warn(`[Session Service] User ${data.viewerId} reached max concurrent sessions for plan ${plan} (Limit: ${limitValue})`);
        } else {
          await prisma.session.create({
            data: {
              hostId: data.hostId,
              viewerId: data.viewerId,
              status: 'ACTIVE',
            },
          });
        }
      } catch (e) {
        console.error('[Session Service] Failed to process SESSION_STARTED', e);
      }
    }

    if (channel === EventChannel.SESSION_ENDED) {
      try {
        const { sessionId } = JSON.parse(message);
        console.log(`[Session Service] Session ended: ${sessionId}`);

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: 'COMPLETED',
            endTime: new Date(),
          },
        });
      } catch (e) {
        console.error('[Session Service] Failed to process SESSION_ENDED', e);
      }
    }
  });

  redisSubscriber.on('error', (err) => {
    console.error('[Session Service] Redis Subscriber Error:', err);
  });
};

const start = async () => {
  console.log('[Session Service] Starting up...');
  registerLegacySessionListeners();

  const server = Fastify({ logger: true });
  await server.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  server.get('/health', async () => ({ status: 'ok', service: 'session-service' }));
  await registerSupportSessionRoutes(server);

  const port = parseInt(process.env.PORT || '3003', 10);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`Session service listening on port ${port}`);
};

start().catch((err) => {
  console.error('[Session Service] Fatal startup error', err);
  process.exit(1);
});
