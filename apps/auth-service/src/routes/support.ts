import { getPublicWebUrl } from '../utils/publicUrls';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken, redisPublisher } from '@remotelink/shared';
import nodemailer from 'nodemailer';
import { emailCard, emailDetails, escapeHtml, multiline } from '../utils/emailCard';


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SUPPORT_EMAIL = 'zainulabidden769@gmail.com';

const WEB_URL = getPublicWebUrl();

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Sender confirmations use the shared Figma card (utils/emailCard.ts) so they
// match the account emails. `greeting` is the raw name (escaped in the card).
const brandedEmail = (opts: {
  greeting?: string;
  heading: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
}) =>
  emailCard({
    hello: opts.greeting ? opts.greeting.replace(/^Hello\s+/i, '') : undefined,
    title: opts.heading,
    body: opts.body,
    action: opts.buttonText ? { label: opts.buttonText, href: opts.buttonUrl || WEB_URL } : undefined,
  });

// Team notifications: same card, addressed to the support team, with the
// submitted fields in a detail table and the free text underneath.
const teamEmail = (opts: { title: string; intro: string; rows: Array<[string, unknown]>; message?: string; replyTo?: string }) =>
  emailCard({
    hello: 'Support Team',
    title: opts.title,
    body: escapeHtml(opts.intro),
    extra:
      emailDetails(opts.rows) +
      (opts.message
        ? `<div style="padding:16px 4px 0;font-size:14px;line-height:20px;color:#111315;text-align:left">${multiline(opts.message)}</div>`
        : ''),
    action: opts.replyTo ? { label: 'Reply To Sender', href: `mailto:${opts.replyTo}` } : undefined,
  });

export default async function supportRoutes(fastify: FastifyInstance) {
  // 0. Public contact form — sends a notification to the team and a branded
  //    confirmation to the sender. No authentication required.
  //    Rate-limited per IP and per sender email so the open endpoint can't be
  //    abused to blast emails through our SMTP account.
  fastify.post('/contact', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, phone, subject, message } = (request.body || {}) as any;

    if (!name || !email || !message) {
      return reply.code(400).send({ error: 'Name, email, and message are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return reply.code(400).send({ error: 'Please enter a valid email address' });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // Abuse throttle: cap submissions per source IP (short window) and per
    // sender email (longer window). Fail-open if Redis is unavailable so the
    // contact form still works.
    try {
      const ip = String(request.ip || 'unknown').slice(0, 45);
      const ipKey = `contact:ip:${ip}`;
      // Note: behind the Caddy reverse proxy request.ip may collapse to the proxy
      // address, so this bucket is effectively a global short-window cap; the
      // per-email cap below is the real anti-spam guard.
      const ipCount = await redisPublisher.incr(ipKey);
      if (ipCount === 1) await redisPublisher.expire(ipKey, 600);
      if (ipCount > 120) return reply.code(429).send({ error: 'Too many requests right now. Please try again in a few minutes.' });

      const toKey = `contact:to:${cleanEmail}`;
      const toCount = await redisPublisher.incr(toKey);
      if (toCount === 1) await redisPublisher.expire(toKey, 3600);
      if (toCount > 5) return reply.code(429).send({ error: 'Too many messages from this address recently. Please try again later.' });
    } catch (rateErr) {
      console.warn('[Contact] Rate-limit check skipped:', (rateErr as any)?.message || rateErr);
    }

    const safeSubject = subject ? String(subject) : 'New contact request';
    const phoneLine = phone ? `Phone: ${phone}\n` : '';

    try {
      // Notify the team
      await transporter.sendMail({
        from: `"Remote365 Contact" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        replyTo: String(email),
        subject: `[Contact] ${safeSubject}`,
        text: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\n${phoneLine}Subject: ${safeSubject}\n\nMessage:\n${message}`,
        html: teamEmail({ title: 'New Contact Form Message', intro: 'Someone wrote to us through the contact form.', rows: [['Name', name], ['Email', email], ['Phone', phone], ['Subject', safeSubject]], message: String(message), replyTo: String(email) }),
      });

      // Confirmation to the sender (branded)
      await transporter.sendMail({
        from: `"Remote365 Team" <${process.env.SMTP_USER}>`,
        to: String(email),
        subject: 'We received your message — Remote365',
        html: brandedEmail({
          greeting: `Hello ${name}`,
          heading: 'Thanks for reaching out',
          body: `We've received your message and a member of our team will get back to you shortly. Here's a copy of what you sent:<br/><br/><em>${multiline(message)}</em>`,
          buttonText: 'Explore Remote365',
          buttonUrl: WEB_URL,
        }),
      });

      return reply.send({ success: true });
    } catch (err: any) {
      // SMTP not configured / delivery failed — don't hard-fail the visitor.
      console.error(`[Contact] Email delivery failed: ${err?.message}`);
      return reply.send({ success: true, delivered: false });
    }
  });

  // 1. Get user's tickets
  fastify.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    try {
      const tickets = await (prisma as any).supportTicket.findMany({
        where: { userId: decoded.userId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(tickets);
    } catch (err) {
      return reply.send([]);
    }
  });

  // 2. Create a new ticket
  fastify.post('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { subject, description, category } = request.body as any;
    if (!subject || !description) return reply.code(400).send({ error: 'Subject and description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    const displayId = `TIC-${Math.floor(1000 + Math.random() * 8999)}`;

    try {
      const ticket = await (prisma as any).supportTicket.create({
        data: {
          userId: decoded.userId,
          displayId,
          subject,
          description,
          category: category || 'Other',
          status: 'Open'
        }
      });

      // Notify the team; confirm to the user. Mail failures are logged and
      // never turn the created ticket into an error.
      try {
        await transporter.sendMail({
        from: `"Remote365 Support" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[New Ticket] ${displayId}: ${subject}`,
        text: `New Support Ticket Created:\n\nUser: ${userEmail}\nID: ${displayId}\nCategory: ${category}\nSubject: ${subject}\n\nDescription:\n${description}`,
        html: teamEmail({ title: 'New Support Ticket', intro: 'A user opened a support case from the app.', rows: [['User', userEmail], ['Case', displayId], ['Category', category], ['Subject', subject]], message: String(description), replyTo: user?.email || undefined }),
        });
        if (user?.email) {
          await transporter.sendMail({
            from: `"Remote365 Support" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: `We received your support case ${displayId}`,
            text: `Hi ${user.name || ''},\n\nWe received your support case ${displayId}: ${subject}. Our team will reply by email.\n\nRegards,\nRemote365 Team`,
            html: brandedEmail({
              greeting: `Hello ${user.name || user.email}`,
              heading: 'We received your support case',
              body: `Case <strong>${esc(displayId)}</strong>: ${esc(subject)}<br/><br/>Our team will reply by email. You can follow the case under Help in Remote365.`,
              buttonText: 'Open Remote365',
            }),
          });
        }
      } catch (mailErr: any) {
        console.error(`[Support] Ticket ${displayId} saved but email failed: ${mailErr?.message || mailErr}`);
      }

      return reply.send(ticket);
    } catch (err: any) {
      console.error(`[Support] Ticket create failed: ${err?.message || err}`);
      return reply.send({ id: 'mock-id', displayId, subject, status: 'Open', createdAt: new Date() });
    }
  });

  // 2b. In-app feedback (desktop sidebar → Feedback). Goes to the team and
  // is acknowledged to the sender.
  fastify.post('/feedback', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
    const { rating, comment, page, appVersion } = (request.body || {}) as any;
    const stars = Math.max(0, Math.min(5, Number(rating) || 0));
    const text = String(comment || '').trim();
    if (!stars && !text) return reply.code(400).send({ error: 'Add a rating or a comment.' });
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';
    try {
      await transporter.sendMail({
        from: `"Remote365 Feedback" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        replyTo: user?.email || undefined,
        subject: `[Feedback] ${stars ? `${stars}/5` : 'No rating'} from ${userEmail}`,
        text: `New feedback:\n\nUser: ${userEmail}\nRating: ${stars || 'none'}/5\nPage: ${page || '-'}\nApp: ${appVersion || '-'}\n\n${text || '(no comment)'}`,
        html: teamEmail({ title: 'New Feedback', intro: 'A user sent feedback from the app.', rows: [['User', userEmail], ['Rating', stars ? `${stars} / 5` : 'No rating'], ['Page', page || '-'], ['App', appVersion || '-']], message: text || '(no comment)', replyTo: user?.email || undefined }),
      });
      if (user?.email) {
        transporter.sendMail({
          from: `"Remote365" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Thanks for your feedback',
          text: `Hi ${user.name || ''},\n\nThank you for your feedback${stars ? ` (${stars}/5)` : ''}. We read every message and it helps us improve Remote365.\n\nRegards,\nRemote365 Team`,
          html: brandedEmail({ greeting: `Hello ${user.name || user.email}`, heading: 'Thanks for your feedback', body: `We read every message${stars ? ` — you rated us <strong>${stars}/5</strong>` : ''}. Your notes help us improve Remote365.${text ? `<br/><br/><em>${multiline(text)}</em>` : ''}`, buttonText: 'Open Remote365' }),
        }).catch((mailErr: any) => console.error(`[Support] Feedback confirmation failed: ${mailErr?.message || mailErr}`));
      }
      return reply.send({ success: true });
    } catch (err: any) {
      console.error(`[Support] Feedback email failed: ${err?.message || err}`);
      return reply.code(502).send({ error: 'Could not send your feedback right now. Please try again in a minute.' });
    }
  });

  // 3. Request a custom guide
  fastify.post('/guides', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { description } = request.body as any;
    if (!description) return reply.code(400).send({ error: 'Description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    try {
      const guideRequest = await (prisma as any).guideRequest.create({
        data: {
          userId: decoded.userId,
          description,
          status: 'Pending'
        }
      });

      // Send Email
      await transporter.sendMail({
        from: `"Remote365 Support" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[Guide Request] New Custom Guide Requested`,
        text: `New Custom Guide Requested:\n\nUser: ${userEmail}\n\nDescription:\n${description}`,
        html: teamEmail({ title: 'New Custom Guide Request', intro: 'A user asked for a custom guide.', rows: [['User', userEmail]], message: String(description), replyTo: user?.email || undefined }),
      });

      return reply.send(guideRequest);
    } catch (err) {
      return reply.send({ success: true, message: 'Request received (mock)' });
    }
  });

  // 4. Technical Report
  fastify.post('/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { subject, description } = request.body as any;
    if (!subject || !description) return reply.code(400).send({ error: 'Subject and description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    try {
      // Send Email
      await transporter.sendMail({
        from: `"Remote365 Reports" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[Technical Report] ${subject}`,
        text: `New Technical Report Submitted:\n\nUser: ${userEmail}\nSubject: ${subject}\n\nReport Details:\n${description}`,
        html: teamEmail({ title: 'New Technical Report', intro: 'A user reported a technical problem.', rows: [['User', userEmail], ['Subject', subject]], message: String(description), replyTo: user?.email || undefined }),
      });
      if (user?.email) {
        transporter.sendMail({
          from: `"Remote365 Support" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'We received your technical report',
          text: `Hi ${user.name || ''},\n\nThanks for the report "${subject}". Our engineers will look into it and reply by email if we need more details.\n\nRegards,\nRemote365 Team`,
          html: brandedEmail({ greeting: `Hello ${user.name || user.email}`, heading: 'We received your technical report', body: `Thanks for the report <strong>${esc(subject)}</strong>. Our engineers will look into it and reply by email if we need more details.`, buttonText: 'Open Remote365' }),
        }).catch((mailErr: any) => console.error(`[Support] Report confirmation failed: ${mailErr?.message || mailErr}`));
      }

      return reply.send({ success: true });
    } catch (err: any) {
      console.error(`[Support] Report email failed: ${err?.message || err}`);
      return reply.code(502).send({ error: 'Could not send the report right now. Please try again in a minute.' });
    }
  });
}
