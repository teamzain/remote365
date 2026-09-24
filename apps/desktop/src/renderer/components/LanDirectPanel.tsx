import React, { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Monitor, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * LAN Direct — reach a machine on the same network with NO internet and no cloud.
 *
 * Two halves in one panel:
 *  - "This Computer": turn the local listener on and set the access password.
 *  - "Hosts On This Network": discover peers over UDP and connect straight to one.
 *
 * The password is the ENTIRE authorization offline (the server can't vouch for
 * anyone when it's unreachable), which is why it is mandatory and why the copy
 * says so plainly rather than treating it as optional hardening.
 */

type LanStatus = {
  enabled: boolean;
  hasPassword: boolean;
  running: boolean;
  addresses: string[];
  port: number;
};

type DiscoveredHost = {
  deviceName: string;
  deviceId: string;
  accessKey: string;
  address: string;
  port: number;
  platform: string;
};

export default function LanDirectPanel({
  onSessionStarting,
}: {
  /** Fired once a LAN connection is accepted, so the shell can show the session UI. */
  onSessionStarting?: (sessionId: string, hostLabel: string) => void;
}) {
  const api = (window as any).electronAPI;
  const [status, setStatus] = useState<LanStatus | null>(null);
  const [password, setPassword] = useState('');
  const [savingHost, setSavingHost] = useState(false);
  const [hostError, setHostError] = useState('');
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [connectTarget, setConnectTarget] = useState<DiscoveredHost | null>(null);
  const [connectError, setConnectError] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api?.lanGetStatus?.());
    } catch {
      /* panel is informational; a failed probe just leaves it blank */
    }
  }, [api]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const applyHostConfig = async (enabled: boolean) => {
    setSavingHost(true);
    setHostError('');
    try {
      const result = await api?.lanConfigure?.({
        enabled,
        ...(password ? { password } : {}),
      });
      if (result && result.ok === false) setHostError(result.error || 'Could not start LAN Direct.');
      else setPassword('');
      await refreshStatus();
    } catch (err: any) {
      setHostError(err?.message || 'Could not update LAN Direct.');
    } finally {
      setSavingHost(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    setConnectError('');
    try {
      setHosts((await api?.lanDiscover?.()) || []);
    } catch {
      setHosts([]);
    } finally {
      setScanning(false);
    }
  };

  const connect = async (address: string, label: string, port?: number) => {
    if (!connectPassword) {
      setConnectError('Enter the LAN password shown on that computer.');
      return;
    }
    setConnectError('');
    const sessionId = `lan:${address}`;
    try {
      const result = await api?.lanConnect?.({ sessionId, address, password: connectPassword, port });
      if (result && result.ok === false) {
        setConnectError(result.error || 'Could not reach that computer.');
        return;
      }
      onSessionStarting?.(sessionId, label || address);
    } catch (err: any) {
      setConnectError(err?.message || 'Could not reach that computer.');
    }
  };

  const running = !!status?.running;

  return (
    <div className="flex flex-col gap-6">
      {/* ── This computer ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#1A1D21]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${running ? 'bg-[#14AE5C]/12 text-[#14AE5C]' : 'bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50'}`}>
              {running ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
            <div>
              <h3 className="m-0 text-[16px] font-semibold text-black dark:text-white">Allow Local Network Access</h3>
              <p className="m-0 mt-1 max-w-xl text-[13px] leading-5 text-black/60 dark:text-white/60">
                Lets someone on this same network connect even when there is no internet.
                Your computer listens locally instead of going through our servers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => applyHostConfig(!status?.enabled)}
            disabled={savingHost || (!status?.enabled && !status?.hasPassword && password.length < 6)}
            className={`shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold transition disabled:opacity-40 ${
              status?.enabled ? 'bg-black/8 text-black dark:bg-white/10 dark:text-white' : 'bg-[#FF8A00] text-white hover:brightness-105'
            }`}
          >
            {savingHost ? 'Saving…' : status?.enabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="text-[12px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {status?.hasPassword ? 'Change Local Password' : 'Set A Local Password (Required)'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status?.hasPassword ? 'Leave blank to keep the current one' : 'At Least 6 Characters'}
            className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] text-black outline-none focus:border-[#FF8A00] dark:border-white/15 dark:bg-[#111315] dark:text-white"
          />
          {password.length > 0 && (
            <button
              type="button"
              onClick={() => applyHostConfig(status?.enabled ?? true)}
              disabled={savingHost || password.length < 6}
              className="w-fit rounded-lg bg-black/8 px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-40 dark:bg-white/10 dark:text-white"
            >
              Save Password
            </button>
          )}
          <p className="m-0 flex items-start gap-2 text-[12px] leading-5 text-black/55 dark:text-white/55">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            While offline this password is the only thing protecting the machine — your
            account permissions can't be checked without the internet. Use a strong one,
            and don't reuse your account password.
          </p>
        </div>

        {running && status?.addresses?.length ? (
          <div className="mt-4 rounded-xl bg-black/4 p-3 dark:bg-white/5">
            <p className="m-0 text-[12px] font-semibold text-black/70 dark:text-white/70">
              Others can reach this computer at:
            </p>
            <p className="m-0 mt-1 font-mono text-[14px] text-black dark:text-white">
              {status.addresses.join('  ·  ')}
            </p>
          </div>
        ) : null}

        {hostError ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[#E5484D]">
            <AlertTriangle size={14} /> {hostError}
          </p>
        ) : null}
      </section>

      {/* ── Hosts on this network ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#1A1D21]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="m-0 text-[16px] font-semibold text-black dark:text-white">Computers On This Network</h3>
            <p className="m-0 mt-1 text-[13px] text-black/60 dark:text-white/60">
              Found without the internet, by asking the local network directly.
            </p>
          </div>
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-black/8 px-3 py-2 text-[13px] font-semibold text-black disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {hosts.map((host) => (
            <button
              key={`${host.address}:${host.deviceId}`}
              type="button"
              onClick={() => { setConnectTarget(host); setManualAddress(''); setConnectError(''); }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                connectTarget?.address === host.address
                  ? 'border-[#FF8A00] bg-[#FF8A00]/6'
                  : 'border-black/10 hover:bg-black/4 dark:border-white/10 dark:hover:bg-white/5'
              }`}
            >
              <Monitor size={18} className="shrink-0 text-black/60 dark:text-white/60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-black dark:text-white">{host.deviceName}</span>
                <span className="block truncate font-mono text-[12px] text-black/50 dark:text-white/50">{host.address}</span>
              </span>
            </button>
          ))}
          {!hosts.length && !scanning ? (
            <p className="m-0 py-3 text-[13px] text-black/50 dark:text-white/50">
              No computers found yet. Press Scan, and make sure the other computer has
              "Allow Local Network Access" turned on.
            </p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-black/8 pt-4 dark:border-white/10">
          <label className="text-[12px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Or Type The Address
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={manualAddress}
              onChange={(e) => { setManualAddress(e.target.value); setConnectTarget(null); }}
              placeholder="192.168.1.42"
              className="w-44 rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-[14px] text-black outline-none focus:border-[#FF8A00] dark:border-white/15 dark:bg-[#111315] dark:text-white"
            />
            <input
              type="password"
              value={connectPassword}
              onChange={(e) => setConnectPassword(e.target.value)}
              placeholder="Local Password"
              className="w-48 rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] text-black outline-none focus:border-[#FF8A00] dark:border-white/15 dark:bg-[#111315] dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                const target = connectTarget;
                if (target) connect(target.address, target.deviceName, target.port);
                else if (manualAddress.trim()) connect(manualAddress.trim(), manualAddress.trim());
                else setConnectError('Pick a computer above or type its address.');
              }}
              className="rounded-lg bg-[#FF8A00] px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-105"
            >
              Connect
            </button>
          </div>
          {connectError ? (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-[#E5484D]">
              <AlertTriangle size={14} /> {connectError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
