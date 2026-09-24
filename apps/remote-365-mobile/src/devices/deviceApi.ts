// Device / device-group management calls. Mirrors the desktop Devices page:
// every mutation here hits the same auth-service endpoints, so per-member
// capability checks (devices:groups:create, devices:assign, …) apply — a 403
// surfaces the server's message to the user.

async function request<T>(
  baseUrl: string,
  token: string | null,
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      // Only declare a JSON body when there is one — Fastify rejects a body-less
      // request that claims application/json (see chatApi.ts for the bug this fixed).
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error: any = new Error(data?.error || data?.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data as T;
}

/**
 * Link an existing device (by its access key) to this account. Mirrors the
 * desktop's add flow: claim ownership so the device joins the user's org, and
 * honor "Remember this device" (unchecked = the host asks for its password on
 * every connect). 401 = password needed/wrong, 404 = unknown ID.
 */
export function addExistingDevice(
  baseUrl: string,
  token: string | null,
  params: { accessKey: string; password?: string; name?: string; remember: boolean },
) {
  return request<any>(baseUrl, token, '/api/devices/add-existing', 'POST', {
    accessKey: params.accessKey,
    ...(params.password ? { password: params.password } : {}),
    ...(params.name ? { name: params.name } : {}),
    claimOwnership: true,
    remember: params.remember,
  });
}

/** Persist trust server-side for passwordless reconnects ("Remember this device"). */
export function trustDevice(baseUrl: string, token: string | null, deviceId: string) {
  return request(baseUrl, token, `/api/devices/${deviceId}/trust`, 'POST', {});
}

export function createDeviceGroup(baseUrl: string, token: string | null, name: string) {
  return request<{ group: any }>(baseUrl, token, '/api/devices/user-groups', 'POST', { name });
}

export function renameDeviceGroup(baseUrl: string, token: string | null, groupId: string, name: string) {
  return request(baseUrl, token, `/api/devices/user-groups/${groupId}`, 'PATCH', { name });
}

export function deleteDeviceGroup(baseUrl: string, token: string | null, groupId: string) {
  return request(baseUrl, token, `/api/devices/user-groups/${groupId}`, 'DELETE');
}

/** Replaces the device's group memberships with exactly `groupIds`. */
export function setDeviceGroups(baseUrl: string, token: string | null, deviceId: string, groupIds: string[]) {
  return request(baseUrl, token, `/api/devices/${deviceId}/user-groups`, 'PATCH', { groupIds });
}

export function renameDevice(baseUrl: string, token: string | null, deviceId: string, name: string) {
  return request(baseUrl, token, `/api/devices/${deviceId}/name`, 'PATCH', { device_name: name });
}

/** Removes the device from this account (unlink). */
export function deleteDevice(baseUrl: string, token: string | null, deviceId: string) {
  return request(baseUrl, token, `/api/devices/${deviceId}`, 'DELETE');
}
