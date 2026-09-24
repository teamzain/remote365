import { mapMeetingItem, MeetingItem } from './meetingUtils';

export async function meetingFetch<T>(
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
    throw new Error(data?.error || data?.message || 'Request failed');
  }

  return data as T;
}

export async function fetchMeetings(apiBaseUrl: string, accessToken?: string | null) {
  const rows = await meetingFetch<any[]>(apiBaseUrl, '/api/chat/meetings', {}, accessToken);
  return rows.map(mapMeetingItem);
}

export async function createMeeting(apiBaseUrl: string, accessToken: string, name: string): Promise<MeetingItem> {
  const row = await meetingFetch<any>(apiBaseUrl, '/api/chat/meetings', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }, accessToken);
  return mapMeetingItem(row);
}
