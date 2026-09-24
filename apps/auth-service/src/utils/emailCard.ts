// Shared Figma "card" layout for transactional emails: 500px white card on a
// grey ground, 45px logo, "Hello Name," line, 16px/600 title, 14px body,
// optional 250x40 orange gradient button, "Need help? Contact us anytime.",
// "Regards, / Remote365 Team" and the Privacy Policy + TechVision365 footer.
// utils/emailTemplates.ts uses the same markup for the account emails; the
// support routes build theirs through this helper so every mail matches.

export const escapeHtml = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escape and keep line breaks from a free-text field. */
export const multiline = (s: unknown) => escapeHtml(s).replace(/\r?\n/g, '<br />');

export const emailButton = (label: string, href: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;width:250px;max-width:100%;box-sizing:border-box;padding:10px 16px;border-radius:4px;background:#FF8A00;background-image:linear-gradient(110.89deg,#FF8A00 36.19%,#FFB347 93.55%);color:#111315;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;text-align:center">${escapeHtml(label)}</a>`;

/**
 * Two-column detail rows (label / value) for team notifications, rendered in
 * the same grey box style as the verification code.
 */
export const emailDetails = (rows: Array<[string, unknown]>) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;border-radius:4px">
    ${rows
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px;font-size:13px;line-height:18px;font-weight:500;color:#111315;white-space:nowrap;vertical-align:top;width:1%">${escapeHtml(label)}</td><td style="padding:8px 12px;font-size:13px;line-height:18px;color:#111315;text-align:left;vertical-align:top;word-break:break-word">${multiline(value)}</td></tr>`,
      )
      .join('')}
  </table>`;

export interface EmailCardOptions {
  /** "Hello Zain," — pass the raw name, it is escaped here. Omit for "Hello,". */
  hello?: string;
  title: string;
  /** HTML (already escaped by the caller). */
  body: string;
  action?: { label: string; href: string };
  /** Extra HTML block between the body and the "Need help?" line. */
  extra?: string;
  /** Left-align the body (for quoted messages). Default centred. */
  align?: 'center' | 'left';
}

export function emailCard(opts: EmailCardOptions): string {
  const align = opts.align || 'center';
  return `
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
                    <td align="center" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 4px">${opts.hello ? `Hello ${escapeHtml(opts.hello)},` : 'Hello,'}</td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:16px;line-height:23px;font-weight:600;color:#111315;padding:0 0 24px">${escapeHtml(opts.title)}</td>
                  </tr>
                  <tr>
                    <td align="${align}" style="font-size:14px;line-height:20px;font-weight:400;color:#111315;padding:0 0 ${opts.extra || opts.action ? 24 : 36}px;text-align:${align}">${opts.body}</td>
                  </tr>
                  ${opts.extra ? `<tr><td style="padding:0 0 ${opts.action ? 24 : 36}px">${opts.extra}</td></tr>` : ''}
                  ${opts.action ? `<tr><td align="center" style="padding:0 0 36px">${emailButton(opts.action.label, opts.action.href)}</td></tr>` : ''}
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
                      Copyright ${new Date().getFullYear()} &copy; TechVision365 Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}
