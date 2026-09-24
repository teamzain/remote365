/**
 * Where the web console lives, for links inside emails. Explicit env first;
 * otherwise the deployment domain (preprod is pp.remote365.ai) — falling back
 * to production sent preprod users to remote365.ai, where they were not
 * signed in.
 */
export const getPublicWebUrl = () => {
  const explicit = process.env.PUBLIC_WEB_URL || process.env.WEB_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = String(process.env.DOMAIN || process.env.CADDY_SITE || '').split(',')[0].trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (domain && !domain.startsWith(':')) return `https://${domain}`;
  return 'https://remote365.ai';
};
