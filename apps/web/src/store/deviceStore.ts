import { create } from 'zustand';

import api from '../lib/api';

interface Device {
  id: string;
  name: string;
  device_name: string;
  type: string;
  device_type: string; // Add for SnowDevices compatibility
  access_key: string;
  is_online: boolean;
  /** Someone (anyone in the org) is in a remote session with this device. */
  in_session?: boolean;
  last_seen_at: string;
  last_seen: string;  // alias for display
  os_type?: string;
  is_owned?: boolean;
  needs_password_update?: boolean;
  device_groups?: Array<{ id: string; name: string; color?: string | null }>;
}

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  fetchDevices: (silent?: boolean) => Promise<void>;
  /**
   * Apply a live push (presence-update / session-status) to one device without
   * refetching the whole list — matched on access key, which is what the
   * signaling server broadcasts. No-ops for an unknown key.
   */
  patchDeviceByKey: (accessKey: string, patch: Partial<Device>) => void;
  addDevice: (accessKey: string, password?: string, options?: { name?: string; remember?: boolean; allowRelink?: boolean }) => Promise<Device>;
  updateDeviceName: (id: string, name: string) => Promise<void>;
  regenerateKey: (id: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  isLoading: false,

  patchDeviceByKey: (accessKey, patch) => {
    const target = String(accessKey || '').toLowerCase().replace(/\s/g, '');
    if (!target) return;
    set((state) => {
      let changed = false;
      const devices = state.devices.map((device) => {
        if (String(device.access_key || '').toLowerCase().replace(/\s/g, '') !== target) return device;
        // Skip no-op writes so a repeated broadcast doesn't re-render the list.
        if (Object.entries(patch).every(([key, value]) => (device as any)[key] === value)) return device;
        changed = true;
        return { ...device, ...patch };
      });
      return changed ? { devices } : state;
    });
  },

  fetchDevices: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { data } = await api.get('/api/devices/mine');
      // Backend returns snake_case; normalize here for UI consistency
      const normalized = data.map((d: any) => ({
        ...d,
        name: d.device_name || d.name || 'Unnamed Device',
        device_type: d.os_type || d.type || 'desktop',
        last_seen: d.last_seen || d.last_seen_at,
      }));
      set({ devices: normalized });
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  addDevice: async (accessKey, password, options) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/devices/add-existing', {
        accessKey,
        password,
        name: options?.name || undefined,
        remember: options?.remember ?? true,
        claimOwnership: true,
        // Restoring a locally-archived device is an intentional re-link; without
        // it the server rejects an ID that is already in the account's list.
        allowRelink: options?.allowRelink === true,
      });
      const rawDevice = data.device || data;
      const normalized = {
        ...rawDevice,
        name: rawDevice.device_name || rawDevice.name || 'Unnamed Device',
        device_name: rawDevice.device_name || rawDevice.name || 'Unnamed Device',
        device_type: rawDevice.os_type || rawDevice.type || rawDevice.device_type || 'desktop',
        last_seen: rawDevice.last_seen || rawDevice.last_seen_at,
      } as Device;
      set((state) => ({ devices: [...state.devices, normalized] }));
      return normalized;
    } catch (err) {
      console.error('Add existing device failed', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateDeviceName: async (id, name) => {
    try {
      await api.patch(`/api/devices/${id}/name`, { device_name: name });
      set((state) => ({
        devices: state.devices.map((d) => (d.id === id ? { ...d, name, device_name: name } : d)),
      }));
    } catch (err) {
      console.error('Update device name failed', err);
      throw err;
    }
  },

  regenerateKey: async (id) => {
    try {
      const { data } = await api.post('/api/devices/regenerate-key', { deviceId: id });
      set((state) => ({
        devices: state.devices.map((d) => (d.id === id ? { ...d, access_key: data.access_key } : d)),
      }));
    } catch (err) {
      console.error('Regenerate key failed', err);
    }
  },

  removeDevice: async (id) => {
    try {
      await api.delete(`/api/devices/${id}`);
      set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
      }));
    } catch (err) {
      console.error('Remove device failed', err);
      throw err;
    }
  },
}));
