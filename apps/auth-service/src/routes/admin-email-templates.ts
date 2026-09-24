import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, prisma, verifyToken } from '@remotelink/shared';
import {
  EMAIL_TEMPLATES, EmailTemplateKey, getTemplateDef, getTemplateOverride,
  renderTemplateString, resolveTemplate, smtpConfigured, createMailTransport,
} from '../utils/emailTemplates';

/**
 * Super Admin -> Settings -> Email Settings.
 * CRUD over the platform email templates: defaults live in code
 * (utils/emailTemplates.ts); the EmailTemplate table stores per-key
 * subject/body/enabled overrides. Gated by `settings:emailTemplates`.
 */

const MAX_SUBJECT = 300;
const MAX_HTML = 100_000;

async function requireTemplateAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader) { reply.code(401).send({ error: 'Unauthorized' }); return null; }
  const decoded = verifyToken(authHeader.split(' ')[1]);
  if (!decoded) { reply.code(401).send({ error: 'Invalid token' }); return null; }
  if (!hasPermission(decoded.role, 'settings:emailTemplates')) {
    reply.code(403).send({ error: 'Email template access required' });
    return null;
  }
  return decoded;
}

async function mergedTemplate(key: EmailTemplateKey) {
  const def = getTemplateDef(key)!;
  const override = await getTemplateOverride(key);
  return {
    key: def.key,
    name: def.name,
    description: def.description,
    subject: override?.subject ?? def.subject,
    html: override?.html ?? def.html,
    enabled: override?.enabled ?? true,
    customized: !!override,
    updatedAt: override?.updatedAt ?? null,
    variables: def.variables,
    sample: def.sample,
  };
}

export default async function adminEmailTemplateRoutes(fastify: FastifyInstance) {
  // GET / — all templates, defaults merged with any overrides.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireTemplateAdmin(request, reply);
    if (!decoded) return;
    const templates = await Promise.all(EMAIL_TEMPLATES.map((t) => mergedTemplate(t.key)));
    return reply.send({ templates, smtpConfigured: smtpConfigured() });
  });

  // PUT /:key — customize subject/body or toggle enabled.
  fastify.put('/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireTemplateAdmin(request, reply);
    if (!decoded) return;
    const { key } = request.params as { key: string };
    const def = getTemplateDef(key);
    if (!def) return reply.code(404).send({ error: 'Unknown template' });

    const body = request.body as { subject?: string; html?: string; enabled?: boolean };
    const current = await mergedTemplate(def.key);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : current.subject;
    const html = typeof body.html === 'string' ? body.html : current.html;
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : current.enabled;

    if (!subject) return reply.code(400).send({ error: 'Subject is required' });
    if (subject.length > MAX_SUBJECT) return reply.code(400).send({ error: `Subject must be under ${MAX_SUBJECT} characters` });
    if (!html.trim()) return reply.code(400).send({ error: 'Body is required' });
    if (html.length > MAX_HTML) return reply.code(400).send({ error: 'Body is too large' });

    await (prisma as any).emailTemplate.upsert({
      where: { key: def.key },
      update: { subject, html, enabled },
      create: { key: def.key, subject, html, enabled },
    });

    return reply.send({ template: await mergedTemplate(def.key) });
  });

  // POST /:key/reset — drop the override, back to the built-in default.
  fastify.post('/:key/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireTemplateAdmin(request, reply);
    if (!decoded) return;
    const { key } = request.params as { key: string };
    const def = getTemplateDef(key);
    if (!def) return reply.code(404).send({ error: 'Unknown template' });

    await (prisma as any).emailTemplate.deleteMany({ where: { key: def.key } });
    return reply.send({ template: await mergedTemplate(def.key) });
  });

  // POST /:key/test — send the template (rendered with sample values) to the
  // signed-in admin, or an explicit address.
  fastify.post('/:key/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireTemplateAdmin(request, reply);
    if (!decoded) return;
    const { key } = request.params as { key: string };
    const def = getTemplateDef(key);
    if (!def) return reply.code(404).send({ error: 'Unknown template' });

    if (!smtpConfigured()) {
      return reply.code(400).send({ error: 'SMTP is not configured on this server, so test emails cannot be sent.' });
    }

    const body = (request.body || {}) as { to?: string };
    let to = String(body.to || '').trim();
    if (!to) {
      const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { email: true } });
      to = user?.email || '';
    }
    if (!to) return reply.code(400).send({ error: 'No destination email address' });

    const { subject, html } = await resolveTemplate(def.key);
    const transporter = createMailTransport();
    try {
      await transporter.sendMail({
        from: `"Remote 365" <${process.env.SMTP_USER}>`,
        to,
        subject: `[Test] ${renderTemplateString(subject, def.sample, false)}`,
        text: renderTemplateString(def.text, def.sample, false),
        html: renderTemplateString(html, def.sample, true),
      });
    } catch (err: any) {
      console.error(`[Email] Test send of "${def.key}" to ${to} failed: ${err.message}`);
      return reply.code(502).send({ error: `Send failed: ${err.message}` });
    }
    return reply.send({ success: true, to });
  });
}
