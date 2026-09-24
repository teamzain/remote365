// Device / machine helpers (extracted from App.tsx, behaviour unchanged).

export const getStoredDevicePassword = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('device_password') || '';
};

export const isRemotePasswordRequired = () => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('remote365_require_password') !== 'false';
};

// True once Easy Access has been decided on this machine (the key is only
// written by lib/easyAccess). Routine registrations (boot, hosting start)
// send the flag only then; an undecided default used to overwrite what the
// server had.
export const isRemotePasswordConfigured = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('remote365_require_password') !== null;
};

// Hardware-derived hash from the main process, sent with self-register so the
// server can recover this machine's existing device row (stable ID) even when
// the cached access key was lost. Empty string when unavailable (web/mobile).
export const getMachineFingerprint = async (): Promise<string> => {
  if (typeof window === 'undefined') return '';
  try {
    const value = (window as any).electronAPI?.getMachineFingerprint
      ? await (window as any).electronAPI.getMachineFingerprint()
      : '';
    return String(value || '');
  } catch {
    return '';
  }
};

export const getMachineDisplayName = async () => {
  if (typeof window === 'undefined') return 'Remote365 Device';
  const saved = localStorage.getItem('remote365_device_name')?.trim();
  if (saved && saved !== 'Unknown Machine') return saved;
  try {
    const apiName = (window as any).electronAPI?.getMachineName
      ? await (window as any).electronAPI.getMachineName()
      : '';
    const clean = String(apiName || '').trim();
    if (clean && clean !== 'Unknown Machine') {
      localStorage.setItem('remote365_device_name', clean);
      return clean;
    }
  } catch {}
  return 'Remote365 Device';
};
