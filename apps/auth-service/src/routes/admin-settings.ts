import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken } from '@remotelink/shared';

export default async function adminSettingsRoutes(fastify: FastifyInstance) {
  // Middleware to ensure the request is authenticated.
  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    if (!hasPermission(decoded.role, 'platform:manage')) {
      return reply.code(403).send({ error: 'Platform settings access required' });
    }
    (request as any).user = decoded;
  });

  // GET /api/admin/settings
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    let settings = await prisma.platformSettings.findFirst();
    if (!settings) {
      // Initialize with defaults if not exists
      settings = await prisma.platformSettings.create({
        data: {} // Uses schema defaults
      });
    }
    return reply.send(settings);
  });

  // PATCH /api/admin/settings
  fastify.patch('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = (request.body || {}) as any;
    
    // Clean data to match schema
    const updateData: any = {};
    const allowedFields = [
      'defaultRelayUrl', 'maxSessionDuration', 'maintenanceMode',
      'maintenanceMessage', 'forceSubAdmin2FA', 'globalTokenLifetime',
      'minPasswordLength', 'maxPasswordLength', 'defaultOrgPlan', 'restrictPlanChanges',
      'recordingAutoRecord', 'recordingQuality', 'recordingStorage', 'recordingRetentionDays',
      'recordingOnlyAdminsDownload', 'recordingOnlyOwnersDelete', 'recordingTechsViewOwn', 'recordingWatermark'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Recording-policy values are enums the viewers act on — reject junk so a
    // bad payload can't wedge every client's policy fetch.
    const recordingEnums: Record<string, string[]> = {
      recordingAutoRecord: ['always', 'ask', 'never'],
      recordingQuality: ['720p', '1080p', '1440p'],
      recordingStorage: ['local'],
    };
    for (const [field, allowed] of Object.entries(recordingEnums)) {
      if (updateData[field] !== undefined && !allowed.includes(String(updateData[field]))) {
        return reply.code(400).send({ error: `Invalid value for ${field}` });
      }
    }
    if (updateData.recordingRetentionDays !== undefined) {
      const days = Number(updateData.recordingRetentionDays);
      if (!Number.isFinite(days) || days < 0 || days > 3650) {
        return reply.code(400).send({ error: 'Invalid value for recordingRetentionDays' });
      }
      updateData.recordingRetentionDays = Math.round(days);
    }
    for (const boolField of ['recordingOnlyAdminsDownload', 'recordingOnlyOwnersDelete', 'recordingTechsViewOwn', 'recordingWatermark']) {
      if (updateData[boolField] !== undefined) updateData[boolField] = Boolean(updateData[boolField]);
    }

    const planFields = ['defaultOrgPlan', 'restrictPlanChanges'];
    if (planFields.some((field) => updateData[field] !== undefined) && !hasPermission((request as any).user?.role, 'plan:manage')) {
      return reply.code(403).send({ error: 'Plan management access required' });
    }

    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { ...updateData, id: 1 }
    });

    return reply.send(settings);
  });
}
