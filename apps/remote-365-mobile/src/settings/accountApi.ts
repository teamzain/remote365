/** Client for the auth-service account/session/support routes used by Settings. */

export type AuthSession = {
  id: string;
  ip?: string;
  userAgent?: string;
  createdAt?: string;
  lastSeen?: string;
  isCurrent?: boolean;
};

async function request<T>(
  apiBaseUrl: string,
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    // Only declare a JSON body when there is one: Fastify rejects a body-less
    // request that claims application/json, which silently broke every POST/DELETE
    // here that sends no payload (delete session, delete account, 2FA on/off).
    const hasBody = options.body !== undefined && options.body !== null;
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return { ok: false, error: data?.error || data?.message || 'Request failed' };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function fetchSessions(apiBaseUrl: string, token: string | null): Promise<AuthSession[]> {
  const res = await request<AuthSession[]>(apiBaseUrl, '/api/auth/sessions', { method: 'GET' }, token);
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export function revokeSession(apiBaseUrl: string, token: string | null, sessionId: string) {
  return request(apiBaseUrl, `/api/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }, token);
}

export function submitFeedback(
  apiBaseUrl: string,
  token: string | null,
  payload: { rating: number; text: string },
) {
  const stars = payload.rating > 0 ? `${payload.rating}/5` : 'no rating';
  return request(
    apiBaseUrl,
    '/api/support/tickets',
    {
      method: 'POST',
      body: JSON.stringify({
        subject: `App feedback (${stars})`,
        description: payload.text || `Rated the mobile app ${stars}.`,
        category: 'feedback',
      }),
    },
    token,
  );
}

export function deleteAccount(apiBaseUrl: string, token: string | null) {
  return request(apiBaseUrl, '/api/auth/me', { method: 'DELETE' }, token);
}

export function changePassword(apiBaseUrl: string, token: string | null, currentPassword: string, newPassword: string) {
  return request(
    apiBaseUrl,
    '/api/auth/me',
    { method: 'PATCH', body: JSON.stringify({ current_password: currentPassword, password: newPassword }) },
    token,
  );
}

/** Kick off enrolment: server generates a TOTP secret and returns a QR code data URL.
 * NB the service registers these under /api/auth/2fa (not /api/2fa) — same
 * paths the desktop profile screen calls. */
export function twoFactorEnable(apiBaseUrl: string, token: string | null) {
  return request<{ qr_code: string }>(apiBaseUrl, '/api/auth/2fa/enable', { method: 'POST' }, token);
}

/** Confirm the 6-digit code from the authenticator, activating 2FA on the account. */
export function twoFactorVerify(apiBaseUrl: string, token: string | null, code: string) {
  return request<{ success: boolean }>(
    apiBaseUrl,
    '/api/auth/2fa/verify',
    { method: 'POST', body: JSON.stringify({ code }) },
    token,
  );
}

/** Remove 2FA entirely — future logins skip the authenticator step. */
export function twoFactorDisable(apiBaseUrl: string, token: string | null) {
  return request<{ success: boolean }>(apiBaseUrl, '/api/auth/2fa/disable', { method: 'POST' }, token);
}
