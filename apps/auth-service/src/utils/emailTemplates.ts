import nodemailer from 'nodemailer';
import { prisma } from '@remotelink/shared';

/**
 * Platform email templates.
 * Every outbound email renders through here: the defaults below carry the
 * original inline designs from the route files, and the super admin can
 * override subject/body or disable a template per key via the EmailTemplate
 * table (managed in the desktop Super Admin console → Settings → Email
 * Settings). `{{token}}` placeholders are replaced from the caller's vars;
 * values are HTML-escaped except keys ending in `Block` (pre-rendered HTML
 * snippets like the optional password row).
 */

export type EmailTemplateKey = 'email-verification' | 'password-reset' | 'org-invitation' | 'session-invite' | 'contact-invite' | 'welcome';

export type EmailTemplateDef = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  /** Placeholders the template understands, shown in the editor UI. */
  variables: string[];
  /** Sample values used for previews and test sends. */
  sample: Record<string, string>;
};

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: 'email-verification',
    name: 'Email Verification',
    description: 'Sent with the 6-digit code when someone creates an account.',
    subject: 'Your Remote365 verification code',
    text: 'Your Remote365 verification code is {{code}}. It expires in 10 minutes.',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">Verify your email</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Enter this code in Remote365 to finish creating your account. It expires in 10 minutes. If you did not request it, you can ignore this email.</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><div style="display:inline-block;min-width:250px;padding:14px 24px;border-radius:4px;background:#F3F4F6;font-size:28px;line-height:1;font-weight:600;letter-spacing:.18em;color:#111315;font-family:Consolas,Menlo,monospace">{{code}}</div></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['code', 'email'],
    sample: { code: '482913', email: 'new.user@example.com' },
  },
  {
    key: 'password-reset',
    name: 'Password Reset',
    description: 'Sent with the reset code when someone forgets their password.',
    subject: 'Your Remote365 password reset code',
    text: 'Your Remote365 password reset code is {{code}}. It expires in 15 minutes.',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">Reset your password</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Use this code to set a new password for {{email}}. It expires in 15 minutes. If you did not ask for a reset, you can ignore this email.</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><div style="display:inline-block;min-width:250px;padding:14px 24px;border-radius:4px;background:#F3F4F6;font-size:28px;line-height:1;font-weight:600;letter-spacing:.18em;color:#111315;font-family:Consolas,Menlo,monospace">{{code}}</div></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['code', 'email'],
    sample: { code: 'K7M2PQ', email: 'user@example.com' },
  },
  {
    key: 'org-invitation',
    name: 'Organization Invitation',
    description: 'Sent when an admin invites a new member to their organization.',
    subject: 'You have been invited to join an organization on Remote365',
    text: 'You have been invited to join your team on Remote365 as a {{role}}. Open this link to set your password and get started: {{inviteLink}} (expires in 7 days).',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">You have been invited to a team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Your team on Remote365 invited you to join as {{role}}. Click the button below to set your password and get started. The invitation expires in 7 days.</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><a href="{{inviteLink}}" style="display:inline-block;width:250px;max-width:100%;box-sizing:border-box;padding:10px 16px;border-radius:4px;background:#FF8A00;background-image:linear-gradient(110.89deg,#FF8A00 36.19%,#FFB347 93.55%);color:#111315;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;text-align:center">Accept invitation</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['role', 'inviteLink', 'email'],
    sample: { role: 'TECHNICIAN', inviteLink: 'https://pp.remote365.ai/onboard?token=sample', email: 'invitee@example.com' },
  },
  {
    key: 'session-invite',
    name: 'Meeting Invitation',
    description: 'Sent when someone invites a contact to a video meeting or remote session.',
    subject: '{{senderName}} invited you to a {{typeLabel}}',
    text: '{{senderName}} invited you to {{sessionName}}.\n\nJoin link: {{sessionLink}}\nSession code: {{sessionCode}}{{passwordLine}}\n\n{{installCopy}}\nDownload: {{installUrl}}',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">{{senderName}} invited you to a {{typeLabel}}</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">{{itemLabel}}: <strong>{{sessionName}}</strong> &middot; Code <strong>{{sessionCode}}</strong>{{passwordBlock}}</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><a href="{{sessionLink}}" style="display:inline-block;width:250px;max-width:100%;box-sizing:border-box;padding:10px 16px;border-radius:4px;background:#FF8A00;background-image:linear-gradient(110.89deg,#FF8A00 36.19%,#FFB347 93.55%);color:#111315;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;text-align:center">{{actionLabel}}</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">{{installCopy}} <a href="{{installUrl}}" style="color:#FF8A00;text-decoration:none;font-weight:500">Download Remote365</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['senderName', 'typeLabel', 'itemLabel', 'actionLabel', 'sessionName', 'sessionCode', 'sessionLink', 'installCopy', 'installUrl', 'passwordBlock', 'passwordLine'],
    sample: {
      senderName: 'Sarah Khan',
      typeLabel: 'Video Meeting',
      itemLabel: 'Meeting',
      actionLabel: 'Join meeting',
      sessionName: 'Weekly Sync',
      sessionCode: '123-456-789',
      sessionLink: 'https://pp.remote365.ai/join/sample',
      installCopy: 'Open Remote365 to join from your notification, or use the link below.',
      installUrl: 'https://remote365.ai/downloads/desktop/',
      passwordBlock: '',
      passwordLine: '',
    },
  },
  {
    key: 'contact-invite',
    name: 'Friend Request',
    description: 'Sent when someone adds a contact (friend request) in chat.',
    subject: '{{senderName}} wants to connect with you on Remote365 chat',
    text: '{{senderName}} ({{senderEmail}}) sent you a contact request in Remote365 chat. Accept it to start messaging: {{chatUrl}}',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">{{senderName}} wants to connect with you</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">{{senderName}} ({{senderEmail}}) sent you a contact request in Remote365 chat. Accept it to start messaging, share files and start remote sessions from the conversation. If you do not know this person, you can ignore this email.</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><a href="{{chatUrl}}" style="display:inline-block;width:250px;max-width:100%;box-sizing:border-box;padding:10px 16px;border-radius:4px;background:#FF8A00;background-image:linear-gradient(110.89deg,#FF8A00 36.19%,#FFB347 93.55%);color:#111315;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;text-align:center">Open Remote365 chat</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['senderName', 'senderEmail', 'chatUrl', 'email'],
    sample: {
      senderName: 'Sarah Khan',
      senderEmail: 'sarah@example.com',
      chatUrl: 'https://pp.remote365.ai/dashboard/chat',
      email: 'invitee@example.com',
    },
  },
  {
    key: 'welcome',
    name: 'Welcome',
    description: 'Sent once when a new account is created (sign-up, Google or Microsoft).',
    subject: 'Welcome to Remote365, {{name}}',
    text: 'Welcome to Remote365, {{name}}! Your account {{email}} is ready. Install the desktop app to make your computers reachable: {{downloadUrl}} — or open the web console at {{appUrl}}. Tip: add this address to your contacts so our emails do not land in spam.',
    html: `
  <div style="margin:0;padding:0;background:#f3f4f6;font-family:'Mona Sans',Inter,'Segoe UI',Arial,sans-serif;color:#111315">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="width:500px;max-width:100%;background:#ffffff;border-radius:12px">
            <tr>
              <td style="padding:24px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px">
                      <img src="https://remote365.ai/logo.png" width="45" height="45" alt="Remote365" style="display:block;width:45px;height:45px;border:0" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">Hello {{name}}</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">Welcome to Remote365</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Your account has been created successfully. Click the button below to sign in.</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 36px"><a href="{{appUrl}}" style="display:inline-block;width:250px;max-width:100%;box-sizing:border-box;padding:10px 16px;border-radius:4px;background:#FF8A00;background-image:linear-gradient(110.89deg,#FF8A00 36.19%,#FFB347 93.55%);color:#111315;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;text-align:center">Sign in</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Install the desktop app to make your computers reachable: <a href="{{downloadUrl}}" style="color:#FF8A00;text-decoration:none;font-weight:500">Download Remote365</a></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 16px">Need help? Contact us anytime.</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:500;color:#111315">Regards,</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 36px">Remote365 Team</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:12px;line-height:17px;font-weight:500;color:#111315">
                      <a href="https://remote365.ai/privacy" style="color:#111315;text-decoration:none">Privacy Policy</a><br />
                      Copyright 2026 &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`,
    variables: ['name', 'email', 'appUrl', 'downloadUrl'],
    sample: { name: 'Alex', email: 'alex@example.com', appUrl: 'https://remote365.ai', downloadUrl: 'https://remote365.ai/downloads' },
  }
];

export const getTemplateDef = (key: string): EmailTemplateDef | undefined =>
  EMAIL_TEMPLATES.find((t) => t.key === key);

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const renderTemplateString = (tpl: string, vars: Record<string, string>, escape: boolean) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    const value = vars[k] ?? '';
    // Keys ending in "Block" are pre-rendered HTML snippets; everything else
    // is user/content data and gets escaped in HTML context.
    return escape && !k.endsWith('Block') ? escapeHtml(value) : value;
  });

/** DB override, or null when the table is missing/unreachable (defaults still work). */
export async function getTemplateOverride(key: string): Promise<{ subject: string; html: string; enabled: boolean; updatedAt: Date } | null> {
  try {
    return await (prisma as any).emailTemplate.findUnique({ where: { key } });
  } catch (err: any) {
    console.error(`[Email] Template override lookup failed for ${key}: ${err.message}`);
    return null;
  }
}

export async function resolveTemplate(key: EmailTemplateKey) {
  const def = getTemplateDef(key)!;
  const override = await getTemplateOverride(key);
  return {
    def,
    subject: override?.subject ?? def.subject,
    html: override?.html ?? def.html,
    enabled: override?.enabled ?? true,
  };
}

export const smtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const createMailTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    requireTLS: true,
    connectionTimeout: 8000,
  });

export type SendResult = { sent: boolean; skipped?: 'smtp-unconfigured' | 'disabled' };

/**
 * Render + send one templated email. Throws on SMTP delivery failure (callers
 * keep their own fallback semantics); returns skipped reasons without
 * throwing.
 */
export async function sendTemplatedEmail({
  to,
  key,
  vars,
  fromName = 'Remote365',
}: {
  to: string;
  key: EmailTemplateKey;
  vars: Record<string, string>;
  fromName?: string;
}): Promise<SendResult> {
  const { def, subject, html, enabled } = await resolveTemplate(key);
  if (!enabled) {
    console.log(`[Email] Template "${key}" is disabled by the admin; skipping send to ${to}.`);
    return { sent: false, skipped: 'disabled' };
  }
  if (!smtpConfigured()) {
    console.log(`[Email] SMTP not configured; skipping "${key}" send to ${to}.`);
    return { sent: false, skipped: 'smtp-unconfigured' };
  }
  const transporter = createMailTransport();
  await transporter.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject: renderTemplateString(subject, vars, false),
    text: renderTemplateString(def.text, vars, false),
    html: renderTemplateString(html, vars, true),
  });
  return { sent: true };
}
