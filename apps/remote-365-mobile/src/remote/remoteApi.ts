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

/**
 * What a 9-digit code turned out to be when the app tried it as a support
 * session code (POST /api/chat/remote-sessions/join).
 *
 * Session codes, meeting codes and device IDs all look alike, so every place
 * that takes a typed or invited code asks the server first. Sending a session
 * code to the meeting socket instead made the server open an empty ad-hoc
 * meeting with this phone as host, so the person who made the code never saw
 * anyone arrive.
 */
export type SessionCodeResult =
  /** Not a support session code: treat it as a meeting code or a device ID. */
  | { kind: 'not-session' }
  /** Session joined; open the viewer on the creator's computer. */
  | { kind: 'viewer'; hostAccessKey: string; token: string; hostName: string }
  /**
   * Session joined on a server that still shares the JOINER's computer. A phone
   * has no screen to share from this app, so this only explains what to do.
   */
  | { kind: 'share-required'; creatorName: string };

export async function joinSessionByCode(
  apiBaseUrl: string,
  accessToken: string | null,
  code: string,
): Promise<SessionCodeResult> {
  // Session codes are all digits; a meeting code may contain letters.
  const raw = String(code || '').replace(/[\s-]/g, '');
  const cleanCode = raw.replace(/\D/g, '');
  if (!accessToken || !cleanCode || cleanCode !== raw) return { kind: 'not-session' };
  let data: any;
  try {
    data = await remoteFetch<any>(
      apiBaseUrl,
      '/api/chat/remote-sessions/join',
      { method: 'POST', body: JSON.stringify({ code: cleanCode }) },
      accessToken,
    );
  } catch (err: any) {
    // 404 = no session has this code. Anything else (expired, already used,
    // your own session) is a session code that cannot be used, and the
    // server's message says why.
    if (err?.status === 404) return { kind: 'not-session' };
    throw err;
  }
  const hostAccessKey = String(data?.hostAccessKey || '').replace(/\D/g, '');
  if (hostAccessKey && data?.token) {
    return {
      kind: 'viewer',
      hostAccessKey,
      token: String(data.token),
      hostName: String(data.hostName || data.creatorName || 'Remote computer'),
    };
  }
  return { kind: 'share-required', creatorName: String(data?.creatorName || '') };
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
