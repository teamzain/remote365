import React, { useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { WebRemoteSupport } from '../../components/dashboard/WebRemoteSupport';
import { useDeviceStore } from '../../store/deviceStore';

const RemoteSupport: React.FC = () => {
  const { devices, fetchDevices } = useDeviceStore();

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return (
    <DashboardLayout title="Remote Support">
      <div className="w-full animate-in fade-in duration-500">
        <WebRemoteSupport devices={devices} onDevicesChanged={() => fetchDevices(true)} />
      </div>
    </DashboardLayout>
  );
};

export default RemoteSupport;
