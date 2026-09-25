import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, redisPublisher } from '@remotelink/shared';

// Public "Which app should we build next?" poll on the website's Downloads
// page (apps/web PlatformVote). No sign-in: each browser keeps a random
// voterId, and voting again changes that browser's choice. Nothing personal
// is stored.

const PLATFORMS = ['macos', 'ios', 'linux'] as const;
type Platform = (typeof PLATFORMS)[number];
const isPlatform = (value: unknown): value is Platform =>
  typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);

const VOTER_ID = /^[A-Za-z0-9_-]{16,64}$/;
const VOTES_PER_HOUR_PER_ADDRESS = 20;

// The client address as Caddy saw it. Caddy appends the peer address to
// X-Forwarded-For, so the LAST entry is the real one; earlier entries come
// from the client and can be forged. (request.ip is Caddy itself: the server
// does not trust proxy headers globally.)
function clientAddress(request: FastifyRequest): string {
  const forwarded = String(request.headers['x-forwarded-for'] || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return (forwarded[forwarded.length - 1] || request.ip || 'unknown').slice(0, 64);
}

async function tally() {
  const rows = await prisma.platformVote.groupBy({ by: ['platform'], _count: { _all: true } });
  const counts: Record<Platform, number> = { macos: 0, ios: 0, linux: 0 };
  for (const row of rows) {
    if (isPlatform(row.platform)) counts[row.platform] = row._count._all;
  }
  return { counts, total: counts.macos + counts.ios + counts.linux };
}

export default async function platformVoteRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const voterId = String((request.query as { voterId?: string })?.voterId || '');
    const result = await tally();
    let yourVote: string | null = null;
    if (VOTER_ID.test(voterId)) {
      const row = await prisma.platformVote.findUnique({ where: { voterId }, select: { platform: true } });
      yourVote = row?.platform ?? null;
    }
    reply.header('Cache-Control', 'no-store');
    return { ...result, yourVote };
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform, voterId } = (request.body || {}) as { platform?: unknown; voterId?: unknown };
    if (!isPlatform(platform)) return reply.code(400).send({ error: 'Choose macOS, iOS or Linux.' });
    if (typeof voterId !== 'string' || !VOTER_ID.test(voterId)) {
      return reply.code(400).send({ error: 'Invalid voter id.' });
    }

    // Abuse throttle per network address. Fail-open: a Redis outage must
    // not break the page.
    try {
      const key = `platform-vote:addr:${clientAddress(request)}`;
      const count = await redisPublisher.incr(key);
      if (count === 1) await redisPublisher.expire(key, 3600);
      if (count > VOTES_PER_HOUR_PER_ADDRESS) {
        return reply.code(429).send({ error: 'Too many votes from this network. Please try again later.' });
      }
    } catch (err) {
      request.log.warn({ err }, '[PlatformVote] rate-limit check skipped');
    }

    await prisma.platformVote.upsert({
      where: { voterId },
      create: { voterId, platform },
      update: { platform },
    });
    reply.header('Cache-Control', 'no-store');
    return { ...(await tally()), yourVote: platform };
  });
}
