// REST helpers for the mobile remote-control viewer. Mirrors the desktop flow:
//   POST /api/devices/verify-access  → { token, remoteSessionId, device }
//   GET  /api/auth/ice-servers       → { iceServers }
// The returned token is a `remote-access` JWT accepted by the signaling `join`.

export type VerifyAccessResult = {
  token: string;
  remoteSessionId: string;
  expiresAt?: string;
  device: { id: string; name: string; isTrusted?: boolean; passwordRequired?: boolean };
};

export async function remoteFetch<T>(
  apiBaseUrl: string,
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  // Only declare a JSON body when there is one — Fastify rejects a body-less
  // request that claims application/json (see chatApi.ts for the bug this fixed).
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err: any = new Error(data?.error || data?.message || 'Request failed');
    err.status = response.status;
    err.retryAfter = data?.retryAfter;
    throw err;
  }
  return data as T;
}

export function verifyDeviceAccess(
  apiBaseUrl: string,
  accessToken: string | null,
  input: { accessKey: string; password?: string },
) {
  const cleanKey = String(input.accessKey || '').replace(/\D/g, '');
  return remoteFetch<VerifyAccessResult>(
    apiBaseUrl,
    '/api/devices/verify-access',
    { method: 'POST', body: JSON.stringify({ accessKey: cleanKey, password: input.password || undefined }) },
    accessToken,
  );
}

export async function fetchIceServers(apiBaseUrl: string, accessToken?: string | null) {
  try {
    const data = await remoteFetch<{ iceServers?: any[] }>(apiBaseUrl, '/api/auth/ice-servers', {}, accessToken);
    if (Array.isArray(data?.iceServers) && data.iceServers.length) return data.iceServers;
  } catch {
    // fall through to STUN
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}
