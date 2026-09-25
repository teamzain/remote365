import { API_URL, IS_DEV, SERVER_HOST } from '../lib/env';

export const PRODUCTION_SERVER_HOST = 'remote365.ai';
// Deployed builds talk to the origin that served them (works unchanged on
// remote365.ai AND pp.remote365.ai); `next dev` keeps hitting prod unless
// NEXT_PUBLIC_SERVER_HOST/NEXT_PUBLIC_API_URL override it.
export const DEFAULT_SERVER_HOST =
  SERVER_HOST
  || API_URL
  || (!IS_DEV && typeof window !== 'undefined' && window.location.host
    ? window.location.host
    : PRODUCTION_SERVER_HOST);

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

