import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowSettings } from '../../components/snow/SnowSettings';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { notify } from '../../components/NotificationProvider';

const Settings: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const [serverIP, setServerIP] = useState(localStorage.getItem('remote_link_server_ip') || window.location.hostname);
  const [autoHost, setAutoHost] = useState(() => localStorage.getItem('is_auto_host_enabled') === 'true');
  
  const updateProfile = async (data: any) => {
    try {
      await api.patch('/api/auth/me', data);
      notify('Profile updated successfully', 'success');
    } catch (err) {
      notify('Failed to update profile', 'error');
    }
  };

  const updatePassword = async (data: any) => {
    try {
      await api.patch('/api/auth/me', data);
      notify('Password updated successfully', 'success');
    } catch (err) {
      notify('Failed to update password', 'error');
    }
  };

  const toggle2FA = async (enable: boolean) => {
    try {
      if (enable) {
        // This would typically open a QR code modal
        await api.post('/api/auth/2fa/enable');
        // For now just notifying, complex 2FA flow can be added if needed
        notify('2FA setup initiated', 'info');
      } else {
        await api.post('/api/auth/2fa/disable');
        updateUser({ ...user!, is_2fa_enabled: false });
        notify('2FA disabled', 'warning');
      }
    } catch (err) {
      notify('Failed to toggle 2FA', 'error');
    }
  };

  const handleSetServerIP = (ip: string) => {
    setServerIP(ip);
    localStorage.setItem('remote_link_server_ip', ip);
    notify('Signaling server updated', 'info');
  };

  return (
    <DashboardLayout title="System Settings">
      <div className="w-full animate-in fade-in duration-700">
        <SnowSettings
          serverIP={serverIP}
          isAutoHostEnabled={autoHost}
          setIsAutoHostEnabled={(value) => {
            setAutoHost(value);
            localStorage.setItem('is_auto_host_enabled', String(value));
          }}
          onRenameDevice={() => notify('Rename devices from the Devices page', 'info')}
          onClose={() => window.history.back()}
          logout={logout}
        />
      </div>
    </DashboardLayout>
  );
};

export default Settings;
