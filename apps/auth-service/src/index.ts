import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports to ensure Prisma finds DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma, redisPublisher, EventChannel, verifyToken } from '@remotelink/shared';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import mfaRoutes from './routes/2fa';
import passwordRoutes from './routes/password';
import deviceRoutes from './routes/devices';
import adminSettingsRoutes from './routes/admin-settings';
import organizationRoutes from './routes/organizations';
import userRoutes from './routes/users';
import adminDeviceRoutes from './routes/admin-devices';
import adminSessionRoutes from './routes/admin-sessions';
import adminOverviewRoutes from './routes/admin-overview';
import adminBillingRoutes from './routes/admin-billing';
import adminEmailTemplateRoutes from './routes/admin-email-templates';
import adminPlanRoutes from './routes/admin-plans';
import memberRoutes from './routes/members';
import groupRoutes from './routes/groups';
import billingRoutes from './routes/billing';
import supportRoutes from './routes/support';
import analyticsRoutes from './routes/analytics';
import chatRoutes from './routes/chat';

// bodyLimit raised to 10MB so base64-encoded avatar uploads (a 2MB image is
// ~2.7MB once base64-encoded) don't exceed Fastify's 1MB default and drop the
// connection (which surfaces as a "Network Error" on the client).
const server = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

server.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

server.addHook('onRequest', async (request, reply) => {
  console.log(`[Auth-Service] ${request.method} ${request.url}`);
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  const decoded = verifyToken(authHeader.replace('Bearer ', ''));
  if (!decoded?.userId || !decoded.sid) return;

  const revoked = await redisPublisher.exists(`auth:sessions:revoked:${decoded.userId}:${decoded.sid}`);
  if (revoked) {
    return reply.code(401).send({ error: 'Session revoked' });
  }
});

server.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

// Onboarding web page — linked from invitation emails.
// The user sets their name and password directly in the browser,
// then opens the desktop app and logs in with those credentials.
server.get('/onboard', async (request, reply) => {
  const { token } = request.query as { token?: string };

  if (!token) {
    return reply.code(400).type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Invalid Link</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa}
.box{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
h2{color:#e53e3e;margin-bottom:12px}p{color:#666}</style></head>
<body><div class="box"><h2>Invalid Link</h2><p>This invitation link is missing a token.<br>Please ask your admin to resend the invite.</p></div></body></html>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Join Organization - Remote 365</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F0F2F5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:24px;padding:44px 40px;width:100%;max-width:440px;box-shadow:0 8px 40px rgba(0,0,0,0.10)}
    .logo{width:56px;height:56px;background:#1C1C1C;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px}
    h1{text-align:center;font-size:20px;font-weight:800;color:#1C1C1C;margin-bottom:6px}
    .sub{text-align:center;font-size:13px;color:#888;margin-bottom:32px;line-height:1.5}
    label{display:block;font-size:11px;font-weight:700;color:#999;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
    .field{margin-bottom:18px}
    input{width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;outline:none;transition:border .15s;background:#FAFAFA}
    input:focus{border-color:#1C1C1C;background:#fff}
    .btn{width:100%;padding:14px;background:#1C1C1C;color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s;margin-top:8px}
    .btn:hover{opacity:.85}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .error{background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:16px;display:none}
    .success{display:none;text-align:center}
    .success .check{font-size:48px;margin-bottom:16px}
    .success h2{font-size:20px;font-weight:800;color:#1C1C1C;margin-bottom:10px}
    .success p{font-size:13px;color:#888;line-height:1.6}
    .success .steps{background:#F8F9FA;border-radius:12px;padding:16px 20px;margin-top:20px;text-align:left}
    .success .steps p{color:#555;font-size:13px;margin-bottom:6px}
    .success .steps p:last-child{margin-bottom:0}
  </style>
</head>
<body>
<div class="card">
  <div id="formView">
    <div class="logo">⚡</div>
    <h1>Finalize Your Access</h1>
    <p class="sub">Set your name and password to join your organization on Remote 365.</p>
    <div class="error" id="errBox"></div>
    <form id="onboardForm">
      <div class="field">
        <label>Full Name</label>
        <input type="text" id="nameInput" placeholder="Enter your full name" required autocomplete="name"/>
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="passInput" placeholder="At least 8 characters" required autocomplete="new-password"/>
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <input type="password" id="confirmInput" placeholder="Repeat password" required autocomplete="new-password"/>
      </div>
      <button type="submit" class="btn" id="submitBtn">Complete Setup</button>
    </form>
  </div>

  <div class="success" id="successView">
    <div class="check">✅</div>
    <h2>Welcome to the Team!</h2>
    <p>Your account has been created successfully.</p>
    <div class="steps">
      <p><strong>Step 1:</strong> Open the Remote 365 desktop app</p>
      <p>👉 <strong>Step 2:</strong> Log in with your email and the password you just set</p>
      <p>👉 <strong>Step 3:</strong> You're in!</p>
    </div>
  </div>
</div>

<script>
  var token = ${JSON.stringify(token)};

  document.getElementById('onboardForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var name = document.getElementById('nameInput').value.trim();
    var pass = document.getElementById('passInput').value;
    var confirm = document.getElementById('confirmInput').value;
    var errBox = document.getElementById('errBox');
    var btn = document.getElementById('submitBtn');

    errBox.style.display = 'none';

    if (!name) { showErr('Full name is required.'); return; }
    if (pass.length < 8) { showErr('Password must be at least 8 characters.'); return; }
    if (pass !== confirm) { showErr('Passwords do not match.'); return; }

    btn.disabled = true;
    btn.textContent = 'Setting up your account…';

    try {
      var res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, name: name, password: pass })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
    } catch(err) {
      showErr(err.message);
      btn.disabled = false;
      btn.textContent = 'Complete Setup';
    }
  });

  function showErr(msg) {
    var b = document.getElementById('errBox');
    b.textContent = msg;
    b.style.display = 'block';
  }
</script>
</body>
</html>`;

  reply.type('text/html').send(html);
});

server.register(authRoutes, { prefix: '/api/auth' });
server.register(oauthRoutes, { prefix: '/api/auth/oauth' });
server.register(mfaRoutes, { prefix: '/api/auth/2fa' });
server.register(passwordRoutes, { prefix: '/api/auth/password' });
server.register(deviceRoutes, { prefix: '/api/devices' });
server.register(organizationRoutes, { prefix: '/api/organizations' });
server.register(userRoutes, { prefix: '/api/admin/users' });
server.register(adminDeviceRoutes, { prefix: '/api/admin/devices' });
server.register(adminSessionRoutes, { prefix: '/api/admin/remote-sessions' });
server.register(adminOverviewRoutes, { prefix: '/api/admin/overview' });
server.register(adminBillingRoutes, { prefix: '/api/admin/billing' });
server.register(adminEmailTemplateRoutes, { prefix: '/api/admin/email-templates' });
server.register(adminPlanRoutes, { prefix: '/api/admin/plans' });
server.register(memberRoutes, { prefix: '/api/members' });
server.register(groupRoutes, { prefix: '/api/groups' });
server.register(billingRoutes, { prefix: '/api/billing' });
server.register(supportRoutes, { prefix: '/api/support' });
server.register(adminSettingsRoutes, { prefix: '/api/admin/settings' });
server.register(analyticsRoutes, { prefix: '/api/analytics' });
server.register(chatRoutes, { prefix: '/api/chat' });

server.setNotFoundHandler((request, reply) => {
  console.log(`[Auth-Service-Wildcard] 404: ${request.method} ${request.url}`);
  reply.code(404).send({ error: `Not Found: ${request.method} ${request.url}` });
});

server.setErrorHandler((error, request, reply) => {
  server.log.error(`[Auth-Service-Error] ${request.method} ${request.url}: ${error.message}`);
  if (error.stack) console.error(error.stack);

  if (error.code === 'P2024') {
    return reply.status(503).send({ error: 'Database timeout, please try again' });
  }
  if (error.message.includes('Redis')) {
    return reply.status(503).send({ error: 'Session service temporarily unavailable' });
  }
  
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({ 
    error: error.message || 'Internal Server Error',
    code: error.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Auth service listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
