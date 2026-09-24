import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken } from '@remotelink/shared';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // Middleware to ensure the request is authenticated.
  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    if (!hasPermission(decoded.role, 'audit:viewPlatform')) {
      return reply.code(403).send({ error: 'Platform audit access required' });
    }
  });

  // GET /api/analytics/summary
  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. User Stats
      const totalUsers = await prisma.user.count();
      const last24hUsers = await prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      });
      const last7dUsers = await prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      });

      // 2. Organization Stats
      const totalOrgs = await prisma.organization.count();
      
      // 3. Device Stats
      const totalDevices = await prisma.device.count();
      
      // 4. Registration Trend (last 7 days)
      const now = new Date();
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate
            }
          }
        });

        trend.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count
        });
      }

      // 5. Recent Users
      const recentUsers = await prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          organization: { select: { id: true, name: true } }
        }
      });

      return reply.send({
        users: {
          total: totalUsers,
          last24h: last24hUsers,
          last7d: last7dUsers,
          trend
        },
        orgs: {
          total: totalOrgs
        },
        devices: {
          total: totalDevices,
          health: {
            cpuUsage: Math.floor(Math.random() * 30) + 10, // Simulated avg
            memoryLoad: Math.floor(Math.random() * 40) + 20, // Simulated avg
            bandwidth: (Math.random() * 500 + 100).toFixed(2), // Mbps
            adapterUsage: Math.floor(Math.random() * 50) + 10
          }
        },
        recentUsers
      });
    } catch (err: any) {
      console.error('[Analytics-Error]', err?.message, err?.stack);
      return reply.code(500).send({ error: err?.message || 'Internal Server Error' });
    }
  });
}
