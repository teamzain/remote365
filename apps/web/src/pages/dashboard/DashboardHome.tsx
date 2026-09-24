import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowDashboard } from '../../components/snow/SnowDashboard';
import { useDeviceStore } from '../../store/deviceStore';

const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { devices, fetchDevices } = useDeviceStore();

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => {
      fetchDevices(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return (
    <DashboardLayout title="Overview">
      <div className="w-full animate-in fade-in duration-700">
        <SnowDashboard
          devices={devices}
          activeSessionCount={devices.filter((device: any) => device.in_session).length}
          telemetryHistory={[]}
          onNavigate={(nextView) => navigate(`/dashboard/${nextView === 'connect' ? 'sessions' : nextView}`)}
        />
      </div>
    </DashboardLayout>
  );
};

export default DashboardHome;
