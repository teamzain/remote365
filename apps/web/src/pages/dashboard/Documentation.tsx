import React from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowDocumentation } from '../../components/snow/SnowDocumentation';

const Documentation: React.FC = () => {
  return (
    <DashboardLayout title="Knowledge Base">
      <div className="w-full animate-in fade-in duration-700">
        <SnowDocumentation />
      </div>
    </DashboardLayout>
  );
};

export default Documentation;
