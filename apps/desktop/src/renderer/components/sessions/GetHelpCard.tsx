import React, { useEffect, useState } from 'react';
import { Copy, Loader2, Monitor, ShieldCheck, UserRound } from 'lucide-react';
import api from '../../lib/api';
import { CreateSupportSessionInput, SupportSession, SupportTechnician, sessionsApi } from '../../lib/sessionsApi';

type Props = {
  session: SupportSession | null;
  loading: boolean;
  onCreate: (input: CreateSupportSessionInput) => Promise<SupportSession>;
  onEnd: () => Promise<void>;
};

type DeviceOption = {
  id: string;
  name?: string | null;
  accessKey?: string | null;
  deviceType?: string | null;
  status?: string | null;
  is_online?: boolean;
};

const formatAccessKey = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 9 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : digits;
};

const getDeviceLabel = (device: DeviceOption) => {
  const name = String(device.name || '').trim();
  const key = formatAccessKey(device.accessKey);
  const base = name || (key ? `Device ${key}` : 'Unnamed Device');
  return `${base}${device.is_online ? ' - online' : ''}`;
};

const copyText = (value: string) => {
  const electronApi = (window as any).electronAPI;
  if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(value);
  else navigator.clipboard?.writeText(value);
};

const statusLabel = (status?: string) => {
  if (status === 'QUEUED' || status === 'CREATED') return 'Waiting';
  if (status === 'ASSIGNED') return 'Technician Assigned';
  if (status === 'RINGING') return 'Connecting';
  if (status === 'CONNECTED') return 'Connected';
  if (status === 'RESOLVED') return 'Resolved';
  return status || 'Waiting';
};

export const GetHelpCard: React.FC<Props> = ({ session, loading, onCreate, onEnd }) => {
  const [issueSummary, setIssueSummary] = useState('');
  const [issueCategory, setIssueCategory] = useState('Device Issue');
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [technicians, setTechnicians] = useState<SupportTechnician[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadOptions = async () => {
      try {
        const [devicesRes, technicianRows] = await Promise.all([
          api.get('/api/devices/mine').catch(() => ({ data: [] })),
          sessionsApi.technicians().catch(() => []),
        ]);
        if (!mounted) return;
        const rawDevices = Array.isArray(devicesRes.data) ? devicesRes.data : (devicesRes.data?.devices || []);
        const nextDevices = rawDevices.map((device: any) => ({
          id: device.id,
          name: device.device_name || device.name,
          accessKey: device.access_key || device.accessKey,
          deviceType: device.deviceType || device.device_type,
          status: device.status,
          is_online: device.is_online,
        })).filter((device: DeviceOption) => device.id);
        setDevices(nextDevices);
        setTechnicians(technicianRows);
        setSelectedDeviceId((current) => current || nextDevices[0]?.id || '');
        setSelectedTechnicianId((current) => current || technicianRows[0]?.id || '');
      } catch {
        if (mounted) setFormError('Could not load devices or technicians right now.');
      }
    };
    loadOptions();
    return () => { mounted = false; };
  }, []);

  const technicianJoined = !!session && ['ASSIGNED', 'RINGING', 'CONNECTED'].includes(session.status);

  const createSession = async () => {
    const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
    if (!selectedDeviceId) {
      setFormError('Select the device that needs help.');
      return;
    }
    if (!selectedTechnicianId) {
      setFormError('Select an organization technician.');
      return;
    }
    if (!issueSummary.trim()) {
      setFormError('Tell the technician what is wrong with the device.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await onCreate({
        deviceId: selectedDeviceId,
        deviceName: selectedDevice?.name || undefined,
        technicianId: selectedTechnicianId,
        issueCategory,
        issueSummary: issueSummary.trim(),
      });
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    setBusy(true);
    try {
      await onEnd();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white dark:bg-[#0F0F0F] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden max-w-2xl mx-auto">
      <div className="p-8 border-b border-gray-100 dark:border-white/5 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <ShieldCheck size={22} className="text-[#1D6DF5]" />
          </div>
          <div>
            <h2 className="text-[30px] font-black text-gray-900 dark:text-white tracking-tight">Need IT Help?</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Generate a temporary support code for a technician.</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {session ? (
          <div className="space-y-5">
            {technicianJoined && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                {session.technicianId ? `Technician ${session.technicianId.slice(0, 8)} has joined` : 'Technician Has Joined'}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#00193F] p-5 text-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">9-Digit Code</div>
                <div className="mt-2 text-[34px] font-black tracking-[0.16em] font-mono">{session.code}</div>
              </div>
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">PIN</div>
                <div className="mt-2 text-[34px] font-black tracking-[0.22em] font-mono text-[#1D6DF5]">{session.pin}</div>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
              <div className="text-[12px] font-bold text-gray-900 dark:text-white">Session status: {statusLabel(session.status)}</div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                {session.deviceName ? `Device: ${session.deviceName}. ` : ''}{session.issueSummary || 'Your issue has been sent.'}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => copyText(`${session.code} PIN ${session.pin}`)} className="flex-1 rounded-xl bg-[#1D6DF5] px-4 py-3 text-[13px] font-bold text-white flex items-center justify-center gap-2">
                <Copy size={15} />
                Copy Code
              </button>
              <button onClick={endSession} disabled={busy || loading} className="rounded-xl bg-gray-900 px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-black">
                Cancel Request
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <Monitor size={13} /> Device
                </span>
                <select
                  value={selectedDeviceId}
                  onChange={(event) => setSelectedDeviceId(event.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
                >
                  <option value="">Select Device</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {getDeviceLabel(device)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <UserRound size={13} /> Technician
                </span>
                <select
                  value={selectedTechnicianId}
                  onChange={(event) => setSelectedTechnicianId(event.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
                >
                  <option value="">Select Technician</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name || technician.email || `Technician ${technician.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <select
              value={issueCategory}
              onChange={(event) => setIssueCategory(event.target.value)}
              className="w-full h-11 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
            >
              <option>Device Issue</option>
              <option>Remote Access Issue</option>
              <option>Performance Issue</option>
              <option>Software Issue</option>
              <option>Other</option>
            </select>

            <textarea
              value={issueSummary}
              onChange={(event) => setIssueSummary(event.target.value)}
              placeholder="Tell the technician what is wrong with this device..."
              className="w-full h-[110px] resize-none rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-3 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
            />
            {formError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-600 dark:text-red-300">
                {formError}
              </div>
            )}
            <button
              onClick={createSession}
              disabled={busy || loading || devices.length === 0 || technicians.length === 0}
              className="w-full rounded-xl bg-[#1D6DF5] px-4 py-3.5 text-[13px] font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {(busy || loading) && <Loader2 size={15} className="animate-spin" />}
              Send request to technician
            </button>
            {(devices.length === 0 || technicians.length === 0) && (
              <p className="text-center text-[11px] text-gray-400">
                {devices.length === 0 ? 'Register or select an assigned device before requesting help.' : 'No organization technicians are available yet.'}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
