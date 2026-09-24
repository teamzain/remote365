import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@remotelink/shared';
import { sendTemplatedEmail } from '../utils/emailTemplates';

function makeCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function sendResetEmail(to: string, code: string) {
  const result = await sendTemplatedEmail({ to, key: 'password-reset', vars: { code, email: to } });
  if (!result.sent) console.log(`[Password-Reset] Email skipped (${result.skipped}). Reset code for ${to}: ${code}`);
}

export default async function passwordRoutes(fastify: FastifyInstance) {
  // POST /api/auth/password/forgot
  fastify.post('/forgot', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as any;
    if (!email) return reply.code(400).send({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) return reply.code(404).send({ error: 'Account does not exist in the system' });

    const code = makeCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: code, passwordResetExpires: expires },
    });

    try {
      await sendResetEmail(email, code);
    } catch (err: any) {
      console.error('[Password-Reset] Email send failed:', err.message);
    }

    return reply.send({ message: 'A reset code has been sent to your email.' });
  });

  // POST /api/auth/password/reset
  fastify.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, code, newPassword } = request.body as any;
    if (!email || !code || !newPassword)
      return reply.code(400).send({ error: 'Email, code, and new password are required' });

    if (newPassword.length < 8)
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (
      !user ||
      !user.passwordResetToken ||
      !user.passwordResetExpires ||
      user.passwordResetToken !== code.toUpperCase().trim() ||
      user.passwordResetExpires < new Date()
    ) {
      return reply.code(400).send({ error: 'Invalid or expired reset code' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpires: null },
    });

    return reply.send({ message: 'Password updated successfully' });
  });
}
