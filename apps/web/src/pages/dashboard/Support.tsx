import React from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowSupport } from '../../components/snow/SnowSupport';

const Support: React.FC = () => {
  return (
    <DashboardLayout title="Help Center">
      <div className="w-full animate-in fade-in duration-700">
        <SnowSupport />
      </div>
    </DashboardLayout>
  );
};

export default Support;
