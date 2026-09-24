export const PRODUCTION_SERVER_HOST = 'remote365.ai';
export const DEFAULT_SERVER_HOST = import.meta.env.VITE_SERVER_HOST || PRODUCTION_SERVER_HOST;

const usesPlainProtocol = (host: string) => {
  const hostname = host.split(':')[0];
  return /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|\d{1,3}(?:\.\d{1,3}){3})$/i.test(hostname);
};

export const normalizeServerHost = (value?: string) => {
  const raw = String(value || DEFAULT_SERVER_HOST).trim();
  if (!raw) return DEFAULT_SERVER_HOST;
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).host;
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
  }
};

export const buildHttpOrigin = (value?: string) => {
  const host = normalizeServerHost(value);
  return `${usesPlainProtocol(host) ? 'http' : 'https'}://${host}`;
};

export const buildSignalUrl = (value?: string) => {
  const host = normalizeServerHost(value);
  return `${usesPlainProtocol(host) ? 'ws' : 'wss'}://${host}/api/signal`;
};

// Public web join page for a meeting. Shared meeting links must be plain
// HTTPS — not remote365:// — so they work for invitees without the app: the
// web page joins as a guest in the browser and offers a Zoom-style
// "open in the app" hand-off for people who have Remote365 installed.
// Support-session invites use the same idea: /join/<code> opens the app when
// it is installed and offers the download otherwise.
export const buildSessionWebUrl = (code: string, value?: string) => {
  const cleanCode = String(code || '').replace(/\D/g, '');
  return `${buildHttpOrigin(value)}/join/${encodeURIComponent(cleanCode)}`;
};

export const buildMeetingWebUrl = (code: string, value?: string) => {
  const cleanCode = String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${buildHttpOrigin(value)}/meeting/${encodeURIComponent(cleanCode)}`;
};

