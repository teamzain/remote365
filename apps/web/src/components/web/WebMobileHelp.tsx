import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Copy, Download, FileText, Info, RefreshCw, ShieldCheck, X } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuthStore } from '../../store/authStore';
import { useDeviceStore } from '../../store/deviceStore';
import { copyText, formatAccessCode } from '../../lib/webPlatform';
import { notify } from '../NotificationProvider';

/**
 * Phone Help sheet — the same entries as the desktop web sidebar's Help
 * popover (WebPremiumShell): Archived Devices, update check, support
 * identifier, privacy, copyright, diagnostics, About. Presented as a bottom
 * sheet with lightweight modals; Privacy/Copyright open the same public
 * pages the desktop popover does.
 */
export const WebMobileHelp: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { devices } = useDeviceStore();
  const [modal, setModal] = useState<'update' | 'support' | 'about' | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const idLabel = formatAccessCode(devices[0]?.access_key);

  const runningBundle = () => (Array.from(document.querySelectorAll('script[src]'))
    .map((s) => (s as HTMLScriptElement).src)
    .find((src) => /assets\/index-[A-Za-z0-9_-]+\.js/.test(src)) || '')
    .match(/index-[A-Za-z0-9_-]+\.js/)?.[0] || '';

  // Same served-bundle vs running-bundle comparison as the desktop popover.
  const checkUpdate = async () => {
    setModal('update');
    setUpdateBusy(true);
    setUpdateAvailable(false);
    setUpdateMessage('Checking for updates...');
    try {
      const html = await fetch(`/?update-check=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const served = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] || '';
      const running = runningBundle();
      if (served && running && served !== running) {
        setUpdateMessage('A newer version of Remote365 is available. Reload to update.');
        setUpdateAvailable(true);
      } else {
        setUpdateMessage('Your version of Remote365 is up-to-date.');
      }
    } catch {
      setUpdateMessage('Could not check for updates. Please try again.');
    } finally {
      setUpdateBusy(false);
    }
  };

  const downloadDiagnostics = () => {
    const lines = [
      `Remote365 web diagnostics — ${new Date().toISOString()}`,
      `Bundle: ${runningBundle() || 'unknown'}`,
      `URL: ${window.location.href}`,
      `User: ${user?.email || 'signed out'} (${user?.id || '-'})`,
      `Role: ${(user as any)?.role || '-'}`,
      `Organization: ${(user as any)?.organizationId || '-'}`,
      `Devices visible: ${devices?.length ?? 0}`,
      `Support ID: ${idLabel || '-'}`,
      `Browser: ${navigator.userAgent}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remote365-web-diagnostics.txt';
    a.click();
    URL.revokeObjectURL(url);
    notify('Diagnostics file downloaded.', 'success');
  };

  const items = [
    { label: 'Archived Devices', icon: Archive, action: () => { onClose(); navigate('/dashboard/devices?archived=1'); } },
    { label: 'Check for new version', icon: RefreshCw, action: () => { onClose(); checkUpdate(); } },
    { label: 'Customer support identifier', icon: Copy, action: async () => { onClose(); await copyText(idLabel); setModal('support'); } },
    { label: 'Privacy policy', icon: ShieldCheck, action: () => { onClose(); window.open('/privacy', '_blank'); } },
    { label: 'Copy right', icon: FileText, action: () => { onClose(); window.open('/terms', '_blank'); } },
    { label: 'Open file logs', icon: Download, action: () => { onClose(); downloadDiagnostics(); } },
    { label: 'About Remote365', icon: Info, action: () => { onClose(); setModal('about'); } },
  ];

  const modalShell = (title: string | null, children: React.ReactNode) => (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/40 p-4" style={{ fontFamily: "'Mona Sans', sans-serif" }} onClick={() => setModal(null)}>
      <div className="flex w-full max-w-[420px] flex-col rounded-xl bg-white px-5 py-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          {title ? <h2 className="m-0 text-[18px] font-bold leading-6 text-[#111315]">{title}</h2> : <span />}
          <button type="button" onClick={() => setModal(null)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)]" title="Close">
            <X size={22} strokeWidth={1.6} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[210]" role="dialog" aria-label="Help">
          <button type="button" aria-label="Close help" onClick={onClose} className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white pb-2 shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', fontFamily: "'Mona Sans', sans-serif" }}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <p className="m-0 px-5 py-3 text-[14px] font-semibold text-[#111315]">Help</p>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]"
                  >
                    <Icon size={18} className="text-[#111315]/55" />
                    <span className="flex-1 text-[14px] font-medium text-[#111315]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modal === 'update' && modalShell('Remote365 update', (
        <div className="flex flex-col gap-5">
          <p className="m-0 text-[14px] leading-5 text-[#111315]">{updateMessage}</p>
          <div className="flex justify-end gap-2">
            {updateAvailable && (
              <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-lg bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-5 text-[14px] font-semibold text-black">
                Reload now
              </button>
            )}
            <button type="button" disabled={updateBusy} onClick={() => setModal(null)} className="h-10 rounded-lg border border-[rgba(26,29,33,0.2)] px-5 text-[14px] font-medium text-[#111315] disabled:opacity-50">
              Close
            </button>
          </div>
        </div>
      ))}

      {modal === 'support' && modalShell('Customer support identifier', (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-[#F3F4F6] px-4 py-3">
            <span className="block text-[13px] text-[rgba(26,29,33,0.7)]">Support identifier</span>
            <span className="block text-[18px] font-semibold tracking-wide text-[#111315]">{idLabel || '—'}</span>
          </div>
          <p className="m-0 text-[12px] leading-4 text-[#111315]/55">Copied to your clipboard — share it with support so they can find your account.</p>
        </div>
      ))}

      {modal === 'about' && modalShell(null, (
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <img src={logo} alt="Remote365" className="h-[50px] w-[50px] object-contain" />
          <p className="m-0 text-[18px] font-bold text-[#111315]">Remote365</p>
          <p className="m-0 text-[13px] text-[#111315]/60">Web console · {runningBundle() || 'development build'}</p>
          <p className="m-0 text-[12px] text-[#111315]/45">Copyright © {new Date().getFullYear()} TechVision365 Inc. All rights reserved.</p>
        </div>
      ))}
    </>
  );
};

export default WebMobileHelp;
