import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, userHasPermission, verifyToken } from '@remotelink/shared';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const groupInclude = {
  devices: {
    select: {
      id: true,
      name: true,
      accessKey: true,
      deviceType: true,
      status: true,
      lastSeenAt: true
    }
  },
  members: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  },
  _count: {
    select: {
      devices: true,
      members: true
    }
  }
};

export default async function groupRoutes(fastify: FastifyInstance) {
  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Unauthorized' });
      return null;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      reply.code(401).send({ error: 'Invalid token' });
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, organizationId: true, permissionOverrides: true }
    });
    const orgId = user?.organizationId || decoded.orgId;
    if (!user || !orgId) {
      reply.code(400).send({ error: 'User must belong to an organization' });
      return null;
    }

    return { ...user, orgId };
  };

  const requireManager = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireUser(request, reply);
    if (!user) return null;
    // Per-user effective check so owner grants/revokes of devices:assign apply.
    if (!userHasPermission(user, 'devices:assign')) {
      reply.code(403).send({ error: 'Device group management access required' });
      return null;
    }
    return user;
  };

  const normalizeIds = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  };

  const validateGroupInput = (body: any, requireName: boolean) => {
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const hasName = name !== undefined && name.length > 0;
    if (requireName && !hasName) return { error: 'Group name is required' };
    if (hasName && name.length > 50) return { error: 'Group name must be 50 characters or fewer' };

    const color = body?.color === null || body?.color === undefined || body?.color === ''
      ? null
      : String(body.color).trim();
    if (color && !HEX_COLOR.test(color)) return { error: 'Color must be a hex value like #2563eb' };

    return { name: hasName ? name : undefined, color };
  };

  // The DB unique index on (orgId, name) is case-sensitive, so "Sales" and
  // "sales" would both be accepted and read as duplicates to a human.
  const findDuplicateName = async (orgId: string, name: string | undefined, exceptId?: string) => {
    if (!name) return null;
    return prisma.deviceGroup.findFirst({
      where: {
        orgId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {})
      },
      select: { name: true }
    });
  };

  const ensureDevicesInOrg = async (orgId: string, deviceIds: string[]) => {
    if (deviceIds.length === 0) return;
    const count = await prisma.device.count({ where: { id: { in: deviceIds }, organizationId: orgId } });
    if (count !== deviceIds.length) throw new Error('One or more devices do not belong to this organization');
  };

  const ensureMembersInOrg = async (orgId: string, memberIds: string[]) => {
    if (memberIds.length === 0) return;
    const count = await prisma.user.count({ where: { id: { in: memberIds }, organizationId: orgId } });
    if (count !== memberIds.length) throw new Error('One or more members do not belong to this organization');
  };

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const groups = await prisma.deviceGroup.findMany({
      where: { orgId: user.orgId },
      include: groupInclude,
      orderBy: { name: 'asc' }
    });

    return reply.send({ groups });
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const body = request.body as any;
    const input = validateGroupInput(body, true);
    if ('error' in input) return reply.code(400).send({ error: input.error });

    const deviceIds = normalizeIds(body?.deviceIds);
    const memberIds = normalizeIds(body?.memberIds);

    const duplicate = await findDuplicateName(user.orgId, input.name as string);
    if (duplicate) return reply.code(409).send({ error: `A group named "${duplicate.name}" already exists` });

    try {
      await ensureDevicesInOrg(user.orgId, deviceIds);
      await ensureMembersInOrg(user.orgId, memberIds);

      const group = await prisma.deviceGroup.create({
        data: {
          orgId: user.orgId,
          name: input.name as string,
          color: input.color,
          devices: deviceIds.length ? { connect: deviceIds.map((id) => ({ id })) } : undefined,
          members: memberIds.length ? { connect: memberIds.map((id) => ({ id })) } : undefined
        },
        include: groupInclude
      });

      return reply.code(201).send({ group });
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.code(409).send({ error: 'A group with this name already exists' });
      return reply.code(400).send({ error: err.message || 'Failed to create group' });
    }
  });

  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const body = request.body as any;
    const input = validateGroupInput(body, false);
    if ('error' in input) return reply.code(400).send({ error: input.error });

    const existing = await prisma.deviceGroup.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'Group not found' });

    const deviceIds = body?.deviceIds === undefined ? null : normalizeIds(body.deviceIds);
    const memberIds = body?.memberIds === undefined ? null : normalizeIds(body.memberIds);

    const duplicate = await findDuplicateName(user.orgId, input.name, id);
    if (duplicate) return reply.code(409).send({ error: `A group named "${duplicate.name}" already exists` });

    try {
      if (deviceIds) await ensureDevicesInOrg(user.orgId, deviceIds);
      if (memberIds) await ensureMembersInOrg(user.orgId, memberIds);

      const group = await prisma.deviceGroup.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(body?.color !== undefined ? { color: input.color } : {}),
          ...(deviceIds ? { devices: { set: deviceIds.map((deviceId) => ({ id: deviceId })) } } : {}),
          ...(memberIds ? { members: { set: memberIds.map((memberId) => ({ id: memberId })) } } : {})
        },
        include: groupInclude
      });

      return reply.send({ group });
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.code(409).send({ error: 'A group with this name already exists' });
      return reply.code(400).send({ error: err.message || 'Failed to update group' });
    }
  });

  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    await prisma.deviceGroup.deleteMany({ where: { id, orgId: user.orgId } });
    return reply.send({ success: true });
  });

  fastify.post('/:id/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const deviceIds = normalizeIds((request.body as any)?.deviceIds);
    if (deviceIds.length === 0) return reply.code(400).send({ error: 'deviceIds is required' });

    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!group) return reply.code(404).send({ error: 'Group not found' });

    try {
      await ensureDevicesInOrg(user.orgId, deviceIds);
      const updated = await prisma.deviceGroup.update({
        where: { id },
        data: { devices: { connect: deviceIds.map((deviceId) => ({ id: deviceId })) } },
        include: groupInclude
      });
      return reply.send({ group: updated });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to add devices' });
    }
  });

  fastify.delete('/:id/devices/:deviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id, deviceId } = request.params as { id: string; deviceId: string };
    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    const device = await prisma.device.findFirst({ where: { id: deviceId, organizationId: user.orgId }, select: { id: true } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const updated = await prisma.deviceGroup.update({
      where: { id },
      data: { devices: { disconnect: [{ id: deviceId }] } },
      include: groupInclude
    });
    return reply.send({ group: updated });
  });

  fastify.post('/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const memberIds = normalizeIds((request.body as any)?.memberIds);
    if (memberIds.length === 0) return reply.code(400).send({ error: 'memberIds is required' });

    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!group) return reply.code(404).send({ error: 'Group not found' });

    try {
      await ensureMembersInOrg(user.orgId, memberIds);
      const updated = await prisma.deviceGroup.update({
        where: { id },
        data: { members: { connect: memberIds.map((memberId) => ({ id: memberId })) } },
        include: groupInclude
      });
      return reply.send({ group: updated });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to add members' });
    }
  });

  fastify.delete('/:id/members/:memberId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireManager(request, reply);
    if (!user) return;

    const { id, memberId } = request.params as { id: string; memberId: string };
    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId: user.orgId }, select: { id: true } });
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    const member = await prisma.user.findFirst({ where: { id: memberId, organizationId: user.orgId }, select: { id: true } });
    if (!member) return reply.code(404).send({ error: 'Member not found' });

    const updated = await prisma.deviceGroup.update({
      where: { id },
      data: { members: { disconnect: [{ id: memberId }] } },
      include: groupInclude
    });
    return reply.send({ group: updated });
  });
}
