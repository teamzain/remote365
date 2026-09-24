import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import * as QRCode from 'qrcode';
import { prisma, verifyToken } from '@remotelink/shared';

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin()
});

export default async function mfaRoutes(fastify: FastifyInstance) {
  // 1. Generate 2FA Secret & QR Code
  fastify.post('/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const secret = totp.generateSecret();
      const otpauth = totp.toURI({ label: user.email, issuer: 'Remote 365', secret });
      const qrCode = await QRCode.toDataURL(otpauth);

      // Save temporary secret to user
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret }
      });

      return reply.send({ qr_code: qrCode });
    } catch (err: any) {
      console.error('[2FA-Enable-Error]', err);
      return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
  });

  // 2. Verify & Activate 2FA
  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const { code } = request.body as any;
      if (!code) return reply.code(400).send({ error: 'Verification code required' });

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.twoFactorSecret) return reply.code(400).send({ error: '2FA not initialized' });

      const isValid = totp.verify(code, { secret: user.twoFactorSecret });
      if (!isValid) return reply.code(400).send({ error: 'Invalid verification code' });

      await prisma.user.update({
        where: { id: user.id },
        data: { is2FAEnabled: true }
      });

      return reply.send({ success: true });
    } catch (err: any) {
      console.error('[2FA-Verify-Error]', err);
      return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
  });

  // 3. Disable 2FA
  fastify.post('/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      await prisma.user.update({
        where: { id: decoded.userId },
        data: { is2FAEnabled: false, twoFactorSecret: null }
      });

      return reply.send({ success: true });
    } catch (err: any) {
      console.error('[2FA-Disable-Error]', err);
      return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
  });
}
