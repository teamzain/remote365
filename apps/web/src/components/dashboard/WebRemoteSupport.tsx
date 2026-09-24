import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Zap } from 'lucide-react';
import api from '../../lib/api';
import { formatAccessKey, recordRecentConnection } from '../../lib/recentConnections';
import { openSessionTab } from '../../lib/sessionLauncher';
import { notify } from '../NotificationProvider';
import { SnowRemoteSupport } from '../snow/SnowRemoteSupport';

interface HostDevice {
  id: string;
  device_name?: string;
  name?: string;
  access_key: string;
  has_password?: boolean;
  password_required?: boolean;
  is_online?: boolean;
}

/**
 * Web wrapper around the desktop `SnowRemoteSupport` page. It renders the exact
 * desktop design/UI and supplies web-appropriate handlers:
 *  - Connect-by-ID runs the browser session flow (verify-access → viewer route),
 *    including the password challenge modal (the desktop shows this at App level).
 *  - Host-only actions (this machine's ID/password, start/stop hosting) are not
 *    available in a browser, so they surface a friendly notice.
 */
export const WebRemoteSupport: React.FC<{ devices?: HostDevice[]; onDevicesChanged?: () => void }> = () => {
  const navigate = useNavigate();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingConnectKey, setPendingConnectKey] = useState<string | null>(null);
  const [connectPassword, setConnectPassword] = useState('');
  const [pendingDeviceName, setPendingDeviceName] = useState<string | null>(null);

  const runConnect = async (accessKey: string, password?: string) => {
    const cleanKey = String(accessKey || '').replace(/\D/g, '');
    if (!cleanKey) return;
    setIsConnecting(true);
    setConnectError(null);
    try {
      const { data } = await api.post('/api/devices/verify-access', {
        accessKey: cleanKey,
        password: password || undefined,
      });
      if (data?.token && data?.device?.id) {
        const name = data.device?.name;
        recordRecentConnection(cleanKey, name);
        setPasswordModalOpen(false);
        setConnectPassword('');
        setPendingConnectKey(null);
        openSessionTab(data.device.id, { accessToken: data.token, deviceName: name, accessKey: cleanKey });
      }
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        setPendingConnectKey(cleanKey);
        setPendingDeviceName(error.response?.data?.device?.name || null);
        setPasswordModalOpen(true);
        setConnectError(password ? 'Incorrect password. Please try again.' : null);
      } else if (status === 409) {
        setConnectError('That device is offline.');
        notify('That device is offline.', 'warning');
      } else {
        const msg = error.response?.data?.error || 'Could not start session.';
        setConnectError(msg);
        notify(msg, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <SnowRemoteSupport
        localAuthKey={null}
        devicePassword=""
        hostStatus=""
        remoteLookupError={connectError}
        isRemoteLookupConnecting={isConnecting}
        onConnect={(partnerId: string) => runConnect(partnerId)}
        onCopyAccessKey={() => notify('Hosting from this browser is a desktop feature.', 'info')}
        onOpenSetPassword={() => notify('Set a device password from the desktop app.', 'info')}
        onStartHosting={() => notify('Hosting a screen requires the desktop app.', 'info')}
        onStopHosting={() => {}}
        onJoinMeeting={() => navigate('/dashboard/meetings')}
        // A session code is not a device ID: joining means sharing THIS computer
        // with the supporter, which needs the desktop app. The join page hands
        // off to it (runConnect used to look the code up as a device and fail
        // with "Device not found").
        onJoinSessionInvite={(code: string) => navigate(`/join/${String(code || '').replace(/\D/g, '')}`)}
        onHostOwnSession={() => notify('Open this session from the desktop app to host.', 'info')}
      />

      {passwordModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="text-[20px] font-bold text-gray-900">Enter access password</h3>
            <p className="text-[13px] text-gray-500 mt-1">
              {pendingDeviceName ? (
                <>
                  Connecting to <span className="font-semibold text-gray-800">{pendingDeviceName}</span>
                </>
              ) : (
                <>
                  Device ID <span className="font-mono font-semibold">{formatAccessKey(pendingConnectKey)}</span>
                </>
              )}
            </p>
            <input
              type="password"
              autoFocus
              value={connectPassword}
              onChange={(e) => setConnectPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && connectPassword && !isConnecting) runConnect(pendingConnectKey!, connectPassword);
              }}
              placeholder="Remote access password"
              className="mt-4 w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 outline-none focus:border-[#FF8A00]"
            />
            {connectError ? <p className="text-[12px] font-medium text-red-500 mt-2">{connectError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalOpen(false);
                  setConnectError(null);
                  setConnectPassword('');
                  setPendingConnectKey(null);
                }}
                className="px-4 py-2.5 text-[13px] font-bold text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runConnect(pendingConnectKey!, connectPassword)}
                disabled={isConnecting || !connectPassword}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-white text-[13px] font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebRemoteSupport;
