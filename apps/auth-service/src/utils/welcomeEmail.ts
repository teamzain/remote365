import { sendTemplatedEmail } from './emailTemplates';
import { getPublicWebUrl } from './publicUrls';

/**
 * Welcome email for a brand-new account (self sign-up after the verification
 * code, or the first Google / Microsoft sign-in). Fire-and-forget: a mail
 * failure must never fail the sign-up, so callers `.catch(() => {})`.
 */
export async function sendWelcomeEmail(user: { email: string; name?: string | null }) {
  const appUrl = getPublicWebUrl();
  const downloadUrl = `${appUrl.replace(/\/$/, '')}/downloads`;
  const name = (user.name || user.email.split('@')[0] || 'there').trim();
  const result = await sendTemplatedEmail({
    to: user.email,
    key: 'welcome',
    vars: { name, email: user.email, appUrl, downloadUrl },
  });
  if (result.sent) console.log(`[Email] Welcome email sent to ${user.email}`);
  return result;
}
