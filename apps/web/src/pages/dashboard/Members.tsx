import React from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowMembers } from '../../components/snow/SnowMembers';

const Members: React.FC = () => {
    return (
        <DashboardLayout title="Team Management">
            <div className="w-full animate-in fade-in duration-700">
                <SnowMembers />
            </div>
        </DashboardLayout>
    );
};

export default Members;
