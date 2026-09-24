export type WebCapability =
  | 'nativeHost'
  | 'desktopUpdates'
  | 'fileLogs'
  | 'windowControls'
  | 'systemNotifications';

export const webCapabilities: Record<WebCapability, boolean> = {
  nativeHost: false,
  desktopUpdates: false,
  fileLogs: false,
  windowControls: false,
  systemNotifications: typeof window !== 'undefined' && 'Notification' in window,
};

export const isCapabilityAvailable = (capability: WebCapability) => webCapabilities[capability];

export const formatAccessCode = (code?: string | null) => {
  const clean = String(code || '').replace(/\D/g, '').slice(0, 9);
  if (!clean) return '--- --- ---';
  return clean.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

export const copyText = async (value: string) => {
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};
